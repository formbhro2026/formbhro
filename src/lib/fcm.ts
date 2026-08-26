/**
 * src/lib/fcm.ts
 *
 * Firebase Cloud Messaging (FCM) integration for the Formbhro Android app.
 *
 * This module is platform-aware:
 *   - On Android (Capacitor): uses native FCM via @capacitor-firebase/messaging
 *   - On web/desktop: all functions are no-ops to preserve existing web behaviour
 *
 * Security model:
 *   - FCM tokens are stored in Supabase (device_tokens table, RLS enforced)
 *   - FCM sends happen ONLY in a Supabase Edge Function using Firebase Admin
 *   - No service-account credentials are ever present in this file or the bundle
 */

import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

/**
 * Returns true when running inside a Capacitor Android/iOS container.
 * Capacitor injects `window.Capacitor` at startup.
 */
export function isCapacitorAndroid(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (
    window as unknown as {
      Capacitor?: { getPlatform?: () => string; isPluginAvailable?: (name: string) => boolean };
    }
  ).Capacitor;
  if (cap?.getPlatform?.() === "android") return true;
  if (cap?.isPluginAvailable?.("GoogleAuth")) return true;
  if (isCapacitor() && /android/i.test(navigator.userAgent)) return true;
  return false;
}

export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;

  // 1. Check window.Capacitor
  const cap = (window as unknown as { Capacitor?: unknown }).Capacitor;
  if (cap != null) return true;

  // 2. Check custom User-Agent appended in capacitor.config.ts
  if (navigator.userAgent && navigator.userAgent.includes("CapacitorFormbhro")) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Lazy-import the Capacitor plugin (only available when actually in Capacitor)
// ---------------------------------------------------------------------------

type FirebaseMessagingPlugin = {
  requestPermissions: () => Promise<{ receive: "granted" | "denied" | "prompt" }>;
  getToken: (options: { vapidKey?: string }) => Promise<{ token: string }>;
  addListener: (
    eventName: "notificationReceived" | "notificationActionPerformed",
    cb: (notification: FCMNotificationPayload | FCMActionPayload) => void,
  ) => Promise<{ remove: () => void }>;
  deleteToken: () => Promise<void>;
};

async function getMessagingPlugin(): Promise<{ plugin: FirebaseMessagingPlugin } | null> {
  if (!isCapacitor()) return null;
  try {
    const mod = await import("@capacitor-firebase/messaging");
    return { plugin: mod.FirebaseMessaging as unknown as FirebaseMessagingPlugin };
  } catch (e) {
    console.warn("[FCM] @capacitor-firebase/messaging not available:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FCMNotificationPayload {
  notification?: {
    title?: string;
    body?: string;
    imageUrl?: string;
  };
  data?: Record<string, string>;
}

export interface FCMActionPayload {
  notification: FCMNotificationPayload;
  actionId: string;
  inputValue?: string;
}

// ---------------------------------------------------------------------------
// Permission + Token
// ---------------------------------------------------------------------------

/**
 * Requests Android notification permission.
 * Returns true if granted, false otherwise.
 * No-op on web (returns false silently).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const result = await getMessagingPlugin();
  if (!result) return false;

  try {
    const { receive } = await result.plugin.requestPermissions();
    return receive === "granted";
  } catch (e) {
    console.error("[FCM] requestPermissions error:", e);
    return false;
  }
}

/**
 * Retrieves the current FCM token from the native layer.
 * Returns null on web or if not available.
 */
export async function getFCMToken(): Promise<string | null> {
  const result = await getMessagingPlugin();
  if (!result) return null;

  try {
    const { token } = await result.plugin.getToken({});
    return token ?? null;
  } catch (e) {
    console.error("[FCM] getToken error:", e);
    return null;
  }
}

/**
 * Generates a stable device ID for this installation.
 * Stored in localStorage so it persists across app restarts.
 */
function getDeviceId(): string {
  const KEY = "formbhro:device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    // Crypto-random UUID, compatible with React 19's targets
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Saves (upserts) the FCM token for the current authenticated user.
 * Called after login and whenever the token refreshes.
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  const deviceId = getDeviceId();
  const platform = isCapacitorAndroid() ? "android" : "web";

  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: userId,
      device_id: deviceId,
      platform,
      fcm_token: token,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id" },
  );

  if (error) {
    console.error("[FCM] Failed to save token:", error.message);
  } else {
    console.log("[FCM] Token saved for device:", deviceId);
  }
}

/**
 * Removes the FCM token for this device from Supabase.
 * Call on user logout to stop notifications being sent to this device.
 */
export async function deleteFCMToken(): Promise<void> {
  const deviceId = getDeviceId();

  // Also delete the native token from FCM (prevents token reuse)
  const result = await getMessagingPlugin();
  if (result) {
    try {
      await result.plugin.deleteToken();
    } catch (e) {
      console.warn("[FCM] deleteToken (native) failed:", e);
    }
  }

  const { error } = await supabase.from("device_tokens").delete().eq("device_id", deviceId);

  if (error) {
    console.warn("[FCM] Failed to delete token from DB:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Notification listeners
// ---------------------------------------------------------------------------

type NavigateCallback = (path: string) => void;

let foregroundListenerCleanup: (() => void) | null = null;
let tapListenerCleanup: (() => void) | null = null;

/**
 * Registers a listener for foreground notifications (app is open).
 * Shows a toast via the provided callback — we integrate with sonner in the caller.
 *
 * @param onNotification - Called with title and body to display
 * @returns cleanup function to unregister the listener
 */
export async function onForegroundNotification(
  onNotification: (title: string, body: string, data?: Record<string, string>) => void,
): Promise<() => void> {
  const result = await getMessagingPlugin();
  if (!result) return () => {};

  try {
    const handle = await result.plugin.addListener(
      "notificationReceived",
      (payload: FCMNotificationPayload | FCMActionPayload) => {
        const n = (payload as FCMNotificationPayload).notification ?? undefined;
        const data = (payload as FCMNotificationPayload).data;
        onNotification(n?.title ?? "Formbhro", n?.body ?? "", data);
      },
    );

    const cleanup = () => handle.remove();
    foregroundListenerCleanup = cleanup;
    return cleanup;
  } catch (e) {
    console.error("[FCM] Failed to add foreground listener:", e);
    return () => {};
  }
}

/**
 * Registers a listener for notification taps (user taps a system notification).
 * Navigates to the relevant route based on notification data.
 *
 * Expected data fields in the notification payload:
 *   - data.route: e.g. "/app/chats/some-request-id"
 *   - data.requestId: e.g. "some-request-uuid"
 *
 * @param navigate - TanStack Router navigate function or window.location.href setter
 */
export async function onNotificationTap(navigate: NavigateCallback): Promise<() => void> {
  const result = await getMessagingPlugin();
  if (!result) return () => {};

  try {
    const handle = await result.plugin.addListener(
      "notificationActionPerformed",
      (payload: FCMNotificationPayload | FCMActionPayload) => {
        const data = (payload as FCMActionPayload).notification?.data;
        if (!data) return;

        // The Edge Function embeds a `route` field in notification data
        const route = data.route;
        const requestId = data.requestId;

        if (route) {
          navigate(route);
        } else if (requestId) {
          navigate(`/app/chats/${requestId}`);
        } else {
          navigate("/app");
        }
      },
    );

    const cleanup = () => handle.remove();
    tapListenerCleanup = cleanup;
    return cleanup;
  } catch (e) {
    console.error("[FCM] Failed to add tap listener:", e);
    return () => {};
  }
}

/**
 * Cleans up all active FCM listeners.
 * Call on unmount of the root component.
 */
export function cleanupFCMListeners(): void {
  foregroundListenerCleanup?.();
  tapListenerCleanup?.();
  foregroundListenerCleanup = null;
  tapListenerCleanup = null;
}

// ---------------------------------------------------------------------------
// Initialization helper
// ---------------------------------------------------------------------------

/**
 * Full FCM initialization sequence.
 * Call once after a user has successfully authenticated.
 *
 * 1. Requests notification permission from the OS
 * 2. Retrieves the FCM token
 * 3. Saves the token to Supabase
 *
 * @param userId - Supabase auth user ID
 * @returns true if the token was successfully registered
 */
export async function initializeFCM(userId: string): Promise<boolean> {
  if (!isCapacitor()) {
    // Web — skip silently
    return false;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    console.info("[FCM] Notification permission not granted.");
    return false;
  }

  const token = await getFCMToken();
  if (!token) {
    console.error("[FCM] Could not retrieve FCM token.");
    return false;
  }

  await saveFCMToken(userId, token);
  return true;
}
