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

  const isCall = data.type === "call";

  const message: Record<string, unknown> = {
    message: {
      token: fcmToken,
      data: {
        ...data,
        title,
        body,
      },
      android: {
        priority: "HIGH",
        ...(isCall
          ? {}
          : {
              notification: {
                channel_id: channelId,
                icon: "ic_stat_notification",
                color: "#FF8A1F",
                sound: "default",
                default_sound: true,
                default_vibrate_timings: true,
                notification_priority: "PRIORITY_MAX",
                visibility: "PUBLIC",
              },
            }),
      },
      ...(!isCall
        ? {
            notification: {
              title,
              body,
            },
          }
        : {}),
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
            sound: isCall ? "ringtone.caf" : "default",
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
  let targetUserIds: string[] = [];

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error("[FCM] Missing required environment variables");
    return new Response("Server configuration error", { status: 500, headers: corsHeaders });
  }

  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (payload.record && typeof payload.record === "object") {
    // Database Webhook format
    notification = payload.record;
    if (notification.receiver_id) {
      targetUserIds.push(notification.receiver_id);
    }
  } else if (payload.notification_type === "call") {
    // CALL NOTIFICATION: Enforce single authority and idempotency by callSessionId
    const callSessionId = payload.call_session_id || (payload as any).callSessionId;
    if (!callSessionId) {
      return new Response(
        JSON.stringify({ error: "call_session_id is required for call notifications" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Idempotency check: Check if a notification for this callSessionId already exists
    const { data: existingNotif } = await sbAdmin
      .from("notifications")
      .select("id")
      .eq("type", "call")
      .eq("call_session_id", callSessionId)
      .maybeSingle();

    if (existingNotif) {
      console.info(
        `[CALL][FCM] Idempotency: Call session ${callSessionId} already notified. Skipping duplicate.`,
      );
      return new Response(
        JSON.stringify({
          sent: 0,
          failed: 0,
          duplicate: true,
          message: "Call session already notified",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Resolve receiver if not explicitly provided
    let receiverId = payload.receiver_id;
    let reqRow: any = null;

    if (payload.request_id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        payload.request_id,
      );
      const { data } = await sbAdmin
        .from("requests")
        .select("id, user_id, assigned_team_id, reference, category")
        .or(
          isUuid
            ? `id.eq.${payload.request_id}`
            : `reference.eq.${payload.request_id},id.eq.${payload.request_id}`,
        )
        .maybeSingle();
      reqRow = data;
    }

    if (!receiverId && reqRow && payload.caller_id) {
      receiverId = payload.caller_id === reqRow.user_id ? reqRow.assigned_team_id : reqRow.user_id;
      if (!receiverId && payload.caller_id === reqRow.user_id) {
        // Unassigned or Admin Direct Chat fallback
        const { data: adminProfiles } = await sbAdmin
          .from("profiles")
          .select("id")
          .eq("role", "admin");
        if (adminProfiles && adminProfiles.length > 0) {
          targetUserIds = adminProfiles.map((p) => p.id);
          receiverId = targetUserIds[0];
        }
      }
    }

    if (receiverId) {
      targetUserIds.push(receiverId);
    }

    // Exclude caller_id so the caller never receives their own incoming call notification
    if (payload.caller_id) {
      targetUserIds = targetUserIds.filter((id) => id !== payload.caller_id);
    }

    if (targetUserIds.length === 0) {
      console.info("[CALL][FCM] No receiver found for call", payload.request_id);
      return new Response(JSON.stringify({ message: "No receiver for this call" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve chat room
    let chatRoomId = payload.chat_room_id;
    if (!chatRoomId && reqRow?.id) {
      const { data: roomRow } = await sbAdmin
        .from("chat_rooms")
        .select("id")
        .eq("request_id", reqRow.id)
        .maybeSingle();
      chatRoomId = roomRow?.id ?? null;
    }

    const notifId = crypto.randomUUID();
    const callTypeLabel = (payload.call_type || payload.title || "Voice")
      .toLowerCase()
      .includes("video")
      ? "Video"
      : "Voice";
    const refOrId = reqRow?.reference || reqRow?.id || payload.request_id;
    const targetRoute =
      payload.route ||
      (receiverId === reqRow?.user_id ? `/app/chats/${refOrId}` : `/team/work?r=${refOrId}`);
    const receiverRole = receiverId === reqRow?.user_id ? "user" : "team";

    notification = {
      id: notifId,
      receiver_id: receiverId || targetUserIds[0],
      title: payload.title ?? `Incoming ${callTypeLabel} Call`,
      body: payload.body ?? "Tap to answer the call",
      type: "call",
      request_id: reqRow?.id || payload.request_id || null,
      chat_room_id: chatRoomId ?? null,
      route: targetRoute,
    };

    // 3. Create the ONE authoritative database notification row
    try {
      const { error: insertErr } = await sbAdmin.from("notifications").insert({
        id: notifId,
        receiver_id: notification.receiver_id,
        role: receiverRole,
        type: "call",
        title: notification.title,
        body: notification.body,
        request_id: notification.request_id,
        chat_room_id: notification.chat_room_id,
        call_session_id: callSessionId,
      });
      if (insertErr) {
        if (
          insertErr.code === "23505" ||
          insertErr.message?.includes("notifications_call_session_unique_idx")
        ) {
          console.info(
            `[CALL][FCM] Concurrent duplicate call session ${callSessionId} prevented by DB index.`,
          );
          return new Response(JSON.stringify({ sent: 0, failed: 0, duplicate: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.warn("[CALL][FCM] Error inserting call notification row:", insertErr);
      } else {
        console.info(
          `[CALL][FCM] Created authoritative notification row for session ${callSessionId}`,
        );
      }
    } catch (dbErr) {
      console.warn("[CALL][FCM] Database insert exception:", dbErr);
    }
  } else if (payload.receiver_id && payload.title) {
    // Direct invocation format — normal message or non-call notification
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
    targetUserIds.push(payload.receiver_id);
  } else {
    return new Response("Invalid notification payload", { status: 200, headers: corsHeaders });
  }

  // Admin Supabase client to fetch device tokens for all target user IDs
  const { data: tokens, error: tokenError } = await sbAdmin
    .from("device_tokens")
    .select("fcm_token, platform")
    .in("user_id", targetUserIds)
    .order("last_seen_at", { ascending: false })
    .limit(5); // Send to at most 5 most recently active devices

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
  if (payload.call_session_id || (payload as any).callSessionId) {
    data.callSessionId = payload.call_session_id || (payload as any).callSessionId;
  }
  if (payload.call_type || (payload as any).callType) {
    data.callType = payload.call_type || (payload as any).callType;
  }
  if (payload.caller_name || (payload as any).callerName) {
    data.callerName = payload.caller_name || (payload as any).callerName;
  }
  if (payload.caller_id || (payload as any).callerId) {
    data.callerId = payload.caller_id || (payload as any).callerId;
  }

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

  const sent = results.filter((r) => r.status === "fulfilled" && r.value.sent).length;
  const failed = results.length - sent;

  // Clean up invalid/unregistered tokens so they don't keep accumulating
  const invalidTokens = results
    .filter((r) => r.status === "fulfilled" && r.value.invalidToken)
    .map(
      (r) =>
        (r as PromiseFulfilledResult<{ token: string; sent: boolean; invalidToken: boolean }>).value
          .token,
    );

  if (invalidTokens.length > 0) {
    console.info(`[FCM] Removing ${invalidTokens.length} invalid token(s) from database`);
    await sbAdmin.from("device_tokens").delete().in("fcm_token", invalidTokens);
  }

  console.info(
    `[FCM] Sent ${sent}/${results.length} notifications, ${failed} failed, ${invalidTokens.length} invalid tokens removed`,
  );

  return new Response(
    JSON.stringify({ sent, failed, total: results.length, invalidRemoved: invalidTokens.length }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
