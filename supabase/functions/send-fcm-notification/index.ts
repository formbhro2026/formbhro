// supabase/functions/send-fcm-notification/index.ts
//
// Supabase Edge Function — sends FCM push notifications when a row is
// inserted into the `notifications` table.
//
// TRIGGER SETUP (run in Supabase SQL editor after deploying this function):
//
//   SELECT supabase_functions.http_request(
//     'POST',
//     'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-fcm-notification',
//     '{"Content-Type":"application/json","Authorization":"Bearer [SUPABASE_SERVICE_ROLE_KEY]"}',
//     '{}',
//     '5000'
//   );
//
// OR set up a Database Webhook in the Supabase Dashboard:
//   Table: notifications, Event: INSERT
//   URL: https://[PROJECT_REF].supabase.co/functions/v1/send-fcm-notification
//
// SECURITY:
//   - FIREBASE_SERVICE_ACCOUNT_JSON  → set in Supabase Edge Function Secrets
//   - SUPABASE_URL                   → auto-provided by Supabase runtime
//   - SUPABASE_SERVICE_ROLE_KEY      → auto-provided by Supabase runtime
//
// NEVER put any of these credentials in the frontend or in the Android APK.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationRecord {
  id: string;
  receiver_id: string;
  title: string;
  body: string | null;
  type: string;
  request_id: string | null;
  chat_room_id: string | null;
  role: string;
  is_read: boolean;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificationRecord;
  schema: string;
  old_record: NotificationRecord | null;
}

interface DeviceToken {
  fcm_token: string;
  platform: string;
}

// ---------------------------------------------------------------------------
// Firebase Admin — HTTP v1 API (no SDK needed in Deno)
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
): Promise<boolean> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data,
      android: {
        priority: "high",
        notification: {
          channel_id: "formbhro_default",
          click_action: "FLUTTER_NOTIFICATION_CLICK", // Capacitor handles this
          color: "#FF8A1F",
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
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Only accept POST (webhook)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Parse the webhook payload
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Only handle notification inserts
  if (payload.type !== "INSERT" || payload.table !== "notifications") {
    return new Response("Not a notification insert", { status: 200 });
  }

  const notification = payload.record;

  // Read environment variables (injected by Supabase runtime)
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error("[FCM] Missing required environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  // Admin Supabase client — can bypass RLS to read device_tokens
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up all device tokens for the notification receiver
  const { data: tokens, error: tokenError } = await supabase
    .from("device_tokens")
    .select("fcm_token, platform")
    .eq("user_id", notification.receiver_id);

  if (tokenError) {
    console.error("[FCM] Failed to fetch device tokens:", tokenError.message);
    return new Response("Database error", { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    console.info(`[FCM] No device tokens for user ${notification.receiver_id}`);
    return new Response("No tokens", { status: 200 });
  }

  // Build notification data payload for deep linking
  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  const projectId = serviceAccount.project_id;

  const data: Record<string, string> = {
    notificationId: notification.id,
    type: notification.type,
  };
  if (notification.request_id) data.requestId = notification.request_id;
  if (notification.chat_room_id) data.chatRoomId = notification.chat_room_id;
  if (notification.request_id) {
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
    return new Response("Firebase auth error", { status: 500 });
  }

  // Send to all devices for this user
  const title = notification.title;
  const body = notification.body ?? "";

  const results = await Promise.allSettled(
    (tokens as DeviceToken[]).map((t) =>
      sendFCMMessage(accessToken, projectId, t.fcm_token, title, body, data),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const failed = results.length - sent;

  console.info(`[FCM] Sent ${sent}/${results.length} notifications, ${failed} failed`);

  return new Response(JSON.stringify({ sent, failed, total: results.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
