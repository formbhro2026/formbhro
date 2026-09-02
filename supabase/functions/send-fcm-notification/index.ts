// @ts-nocheck
// supabase/functions/send-fcm-notification/index.ts
//
// Supabase Edge Function — sends High-Priority FCM push notifications (WhatsApp-style
// heads-up banners with sound & vibration) when triggered via database webhook or direct RPC.
//
// SECURITY:
//   - FIREBASE_SERVICE_ACCOUNT_JSON  → set in Supabase Edge Function Secrets
//   - SUPABASE_URL                   → auto-provided by Supabase runtime
//   - SUPABASE_SERVICE_ROLE_KEY      → auto-provided by Supabase runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationRecord {
  id?: string;
  receiver_id: string;
  title: string;
  body: string | null;
  type: string;
  request_id?: string | null;
  chat_room_id?: string | null;
  role?: string;
  is_read?: boolean;
  created_at?: string;
  route?: string;
}

interface WebhookPayload {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  record?: NotificationRecord;
  schema?: string;
  old_record?: NotificationRecord | null;
  // Direct invocation properties:
  receiver_id?: string;
  title?: string;
  body?: string;
  notification_type?: string;
  request_id?: string;
  chat_room_id?: string;
  route?: string;
  // When receiver_id is omitted, the function will resolve it from request_id
  // by looking at the requests table (using the auth token to determine caller side).
  caller_id?: string;
}

interface DeviceToken {
  fcm_token: string;
  platform: string;
}

// ---------------------------------------------------------------------------
// Firebase Admin — HTTP v1 API
// ---------------------------------------------------------------------------

async function getFirebaseAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  // Encode JWT
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import the RSA private key
  const privateKey = serviceAccount.private_key;
  const keyData = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const jwt = `${signingInput}.${signatureB64}`;

  // Exchange JWT for OAuth2 access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

async function sendFCMMessage(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ sent: boolean; invalidToken: boolean }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  // Select channel based on notification type for proper heads-up / ringtone routing
  let channelId = "formbhro_default_v2";
  if (data.type === "call") {
    channelId = "formbhro_calls_v2";
  } else if (data.type === "message") {
    channelId = "formbhro_messages_v2";
  }

  const message = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data,
      android: {
        priority: "HIGH",
        notification: {
          channel_id: channelId,
          sound: "default",
          default_sound: true,
          default_vibrate_timings: true,
          notification_priority: "PRIORITY_MAX",
          visibility: "PUBLIC",
          color: "#FF8A1F",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: "default",
            badge: 1,
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[FCM] Send failed for token ${fcmToken.slice(0, 20)}...:`, errorText);
    // Firebase reports invalid/expired tokens with these error codes
    const invalidToken =
      errorText.includes("UNREGISTERED") ||
      errorText.includes("NOT_FOUND") ||
      errorText.includes("INVALID_ARGUMENT");
    return { sent: false, invalidToken };
  }

  return { sent: true, invalidToken: false };
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Parse payload (supports both Database Webhook & direct invocation)
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  let notification: NotificationRecord;

  if (payload.record && typeof payload.record === "object") {
    // Database Webhook format
    notification = payload.record;
  } else if (payload.receiver_id && payload.title) {
    // Direct invocation format — receiver_id explicitly provided
    notification = {
      id: crypto.randomUUID(),
      receiver_id: payload.receiver_id,
      title: payload.title,
      body: payload.body ?? null,
      type: payload.notification_type ?? "message",
      request_id: payload.request_id ?? null,
      chat_room_id: payload.chat_room_id ?? null,
      route: payload.route,
    };
  } else if (payload.request_id && payload.notification_type === "call" && payload.caller_id) {
    // Direct invocation without explicit receiver_id:
    // Resolve the receiver from the requests table server-side.
    const SUPABASE_URL_EARLY = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY_EARLY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL_EARLY || !SUPABASE_SERVICE_ROLE_KEY_EARLY) {
      return new Response("Server configuration error", { status: 500, headers: corsHeaders });
    }
    const sbAdmin = createClient(SUPABASE_URL_EARLY, SUPABASE_SERVICE_ROLE_KEY_EARLY);
    // request_id may be a UUID or a reference string (e.g. FRM-XXXXX) depending on caller context
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      payload.request_id,
    );
    const { data: reqRow } = await sbAdmin
      .from("requests")
      .select("id, user_id, assigned_team_id, reference")
      .or(
        isUuid
          ? `id.eq.${payload.request_id}`
          : `reference.eq.${payload.request_id},id.eq.${payload.request_id}`,
      )
      .maybeSingle();
    if (!reqRow) {
      return new Response("Request not found", { status: 200, headers: corsHeaders });
    }
    // The receiver is the party that is NOT the caller
    const receiverId =
      payload.caller_id === reqRow.user_id ? reqRow.assigned_team_id : reqRow.user_id;
    if (!receiverId) {
      console.info("[FCM] No receiver found for request", payload.request_id);
      return new Response(JSON.stringify({ message: "No receiver for this request" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Find chat room using the resolved DB UUID
    const { data: roomRow } = await sbAdmin
      .from("chat_rooms")
      .select("id")
      .eq("request_id", reqRow.id)
      .maybeSingle();
    const callTypeLabel = payload.title?.toLowerCase().includes("video") ? "Video" : "Voice";
    const refOrId = reqRow.reference || reqRow.id;
    const targetRoute =
      receiverId === reqRow.user_id ? `/app/chats/${refOrId}` : `/team/work?r=${refOrId}`;

    notification = {
      id: crypto.randomUUID(),
      receiver_id: receiverId,
      title: payload.title ?? `Incoming ${callTypeLabel} Call`,
      body: payload.body ?? "Tap to answer the call",
      type: "call",
      request_id: reqRow.id,
      chat_room_id: roomRow?.id ?? null,
      route: targetRoute,
    };

    // Insert into notifications table so in-app Realtime subscribers receive the call event
    try {
      await sbAdmin.from("notifications").insert({
        id: notification.id,
        receiver_id: notification.receiver_id,
        role: receiverId === reqRow.user_id ? "user" : "team",
        type: "call",
        title: notification.title,
        body: notification.body,
        request_id: notification.request_id,
        chat_room_id: notification.chat_room_id,
        route: notification.route,
      });
    } catch (dbErr) {
      console.warn("[FCM] Could not insert call notification into table:", dbErr);
    }
  } else {
    return new Response("Invalid notification payload", { status: 200, headers: corsHeaders });
  }

  // Read environment variables
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error("[FCM] Missing required environment variables");
    return new Response("Server configuration error", { status: 500, headers: corsHeaders });
  }

  // Admin Supabase client to fetch device tokens
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: tokens, error: tokenError } = await supabase
    .from("device_tokens")
    .select("fcm_token, platform")
    .eq("user_id", notification.receiver_id)
    .order("last_seen_at", { ascending: false })
    .limit(3); // Send to at most 3 most recently active devices

  if (tokenError) {
    console.error("[FCM] Failed to fetch device tokens:", tokenError.message);
    return new Response("Database error", { status: 500, headers: corsHeaders });
  }

  if (!tokens || tokens.length === 0) {
    console.info(`[FCM] No device tokens for user ${notification.receiver_id}`);
    return new Response(JSON.stringify({ message: "No active device tokens found" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build deep link data payload
  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  const projectId = serviceAccount.project_id;

  const data: Record<string, string> = {
    notificationId: notification.id ?? crypto.randomUUID(),
    type: notification.type,
  };
  if (notification.request_id) data.requestId = notification.request_id;
  if (notification.chat_room_id) data.chatRoomId = notification.chat_room_id;

  if (notification.route) {
    data.route = notification.route;
  } else if (notification.request_id) {
    data.route = `/app/chats/${notification.request_id}`;
  } else {
    data.route = "/app";
  }

  // Get Firebase access token
  let accessToken: string;
  try {
    accessToken = await getFirebaseAccessToken(FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error("[FCM] Failed to get Firebase access token:", e);
    return new Response("Firebase auth error", { status: 500, headers: corsHeaders });
  }

  // Dispatch high-priority FCM notification to all registered devices
  const title = notification.title;
  const body = notification.body ?? "";

  const results = await Promise.allSettled(
    (tokens as DeviceToken[]).map((t) =>
      sendFCMMessage(accessToken, projectId, t.fcm_token, title, body, data).then((result) => ({
        token: t.fcm_token,
        ...result,
      })),
    ),
  );

  const sent = results.filter(
    (r) => r.status === "fulfilled" && r.value.sent,
  ).length;
  const failed = results.length - sent;

  // Clean up invalid/unregistered tokens so they don't keep accumulating
  const invalidTokens = results
    .filter((r) => r.status === "fulfilled" && r.value.invalidToken)
    .map((r) => (r as PromiseFulfilledResult<{ token: string; sent: boolean; invalidToken: boolean }>).value.token);

  if (invalidTokens.length > 0) {
    console.info(`[FCM] Removing ${invalidTokens.length} invalid token(s) from database`);
    await supabase
      .from("device_tokens")
      .delete()
      .in("fcm_token", invalidTokens);
  }

  console.info(`[FCM] Sent ${sent}/${results.length} notifications, ${failed} failed, ${invalidTokens.length} invalid tokens removed`);

  return new Response(JSON.stringify({ sent, failed, total: results.length, invalidRemoved: invalidTokens.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
