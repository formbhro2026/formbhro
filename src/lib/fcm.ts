/**
 * src/lib/fcm.ts
 *
 * Firebase Cloud Messaging (FCM) & Push Notification integration for Formbhro.
 *
 * This module is platform-aware:
 *   - On Android (Capacitor): uses native FCM via @capacitor-firebase/messaging with High-Importance notification channels.
 *   - On Web / PWA / Desktop: requests Web Notification permission and displays system notifications.
 *
 * Security model:
 *   - FCM tokens are stored in Supabase (device_tokens table, RLS enforced)
 *   - FCM sends happen in Supabase Edge Function using Firebase Admin HTTP v1 API
 *   - No service-account credentials are ever present in this file or the bundle
 */

import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

/**
 * Returns true when running inside a Capacitor Android/iOS container.
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

export interface NotificationChannelOptions {
  id: string;
  name: string;
  description?: string;
  importance?: number; // 1 = min, 2 = low, 3 = default, 4 = high, 5 = max
  visibility?: number; // -1 = secret, 0 = private, 1 = public
  sound?: string;
  vibration?: boolean;
  lights?: boolean;
  lightColor?: string;
}

type FirebaseMessagingPlugin = {
  requestPermissions: () => Promise<{ receive: "granted" | "denied" | "prompt" }>;
  getToken: (options: { vapidKey?: string }) => Promise<{ token: string }>;
  addListener: (
    eventName: "notificationReceived" | "notificationActionPerformed",
    cb: (notification: FCMNotificationPayload | FCMActionPayload) => void,
  ) => Promise<{ remove: () => void }>;
  deleteToken: () => Promise<void>;
  createChannel?: (options: NotificationChannelOptions) => Promise<void>;
  listChannels?: () => Promise<{ channels: NotificationChannelOptions[] }>;
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
// Notification Channels (Android Heads-Up / WhatsApp-style popups)
// ---------------------------------------------------------------------------

/**
 * Creates high-priority notification channels on Android.
 * Android 8.0+ (API 26+) requires a channel with importance 5 (IMPORTANCE_HIGH)
 * for notifications to pop on the screen (heads-up) with sound and vibration.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  const result = await getMessagingPlugin();
  if (!result || typeof result.plugin.createChannel !== "function") return;

  const channels: NotificationChannelOptions[] = [
    {
      id: "formbhro_calls_v2",
      name: "Incoming Calls",
      description: "Alerts for incoming audio and video calls",
      importance: 5, // IMPORTANCE_HIGH (pops on screen + rings)
      visibility: 1, // PUBLIC (shows on lock screen)
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#FF8A1F",
    },
    {
      id: "formbhro_messages_v2",
      name: "Messages & Updates",
      description: "New message alerts from experts and team members",
      importance: 5, // IMPORTANCE_HIGH (heads-up banner)
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#FF8A1F",
    },
    {
      id: "formbhro_default_v2",
      name: "General Notifications",
      description: "General system and request updates",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#FF8A1F",
    },
  ];

  for (const ch of channels) {
    try {
      await result.plugin.createChannel(ch);
      console.log(`[FCM] Channel '${ch.id}' configured.`);
    } catch (e) {
      console.warn(`[FCM] Could not create channel '${ch.id}':`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Permission + Token
// ---------------------------------------------------------------------------

/**
 * Requests notification permission from Android or Web Browser.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isCapacitor()) {
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

  // Web Notification API fallback
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Displays a system top notification using Web Notification API if permitted.
 */
export function showSystemNotification(
  title: string,
  body: string,
  options?: {
    data?: Record<string, string>;
    onClick?: () => void;
  },
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      data: options?.data,
    });

    if (options?.onClick) {
      notif.onclick = () => {
        window.focus();
        options.onClick?.();
        notif.close();
      };
    }
  } catch (err) {
    console.warn("[Notification] Could not display system notification:", err);
  }
}

/**
 * Retrieves the current FCM token from the native layer.
 * Returns null on web or if not available.
 */
export async function getFCMToken(): Promise<string | null> {
  const result = await getMessagingPlugin();
  if (!result) return null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { token } = await result.plugin.getToken({});
      if (token && token.trim().length > 0) {
        return token;
      }
    } catch (e) {
      console.warn(`[FCM] getToken attempt ${attempt} error:`, e);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  return null;
}

/**
 * Generates a stable device ID for this installation.
 * Stored in localStorage so it persists across app restarts.
 */
function getDeviceId(): string {
  const KEY = "formbhro:device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
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
 */
export async function initializeFCM(userId: string): Promise<boolean> {
  if (!isCapacitor()) {
    // Request web notification permissions if on browser
    void requestNotificationPermission();
    return false;
  }

  // 1. Setup Android Notification Channels with High Importance
  await setupAndroidNotificationChannels();

  // 2. Request permission
  const granted = await requestNotificationPermission();
  if (!granted) {
    console.info("[FCM] Notification permission not granted.");
    return false;
  }

  // 3. Retrieve and save token
  const token = await getFCMToken();
  if (!token) {
    console.error("[FCM] Could not retrieve FCM token.");
    return false;
  }

  await saveFCMToken(userId, token);
  return true;
}
