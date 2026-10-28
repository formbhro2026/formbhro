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
    // v3 Channels (Primary)
    {
      id: "formbhro_calls_v3",
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
      id: "formbhro_messages_v3",
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
      id: "formbhro_default_v3",
      name: "General Notifications",
      description: "General system and request updates",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#FF8A1F",
    },
    // v2 Channels (Backward compatibility)
    {
      id: "formbhro_calls_v2",
      name: "Incoming Calls Legacy",
      description: "Alerts for incoming audio and video calls",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#FF8A1F",
    },
    {
      id: "formbhro_messages_v2",
      name: "Messages & Updates Legacy",
      description: "New message alerts from experts and team members",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#FF8A1F",
    },
    {
      id: "formbhro_default_v2",
      name: "General Notifications Legacy",
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
// Native Bridge Battery & Notification Helpers
// ---------------------------------------------------------------------------

export function isBatteryOptimizationIgnored(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return (window as any).FormbharoNativeBridge?.isBatteryOptimizationIgnored?.() ?? true;
  } catch {
    return true;
  }
}

export function requestIgnoreBatteryOptimizations(): void {
  if (typeof window === "undefined") return;
  try {
    (window as any).FormbharoNativeBridge?.requestIgnoreBatteryOptimizations?.();
  } catch (e) {
    console.warn("[FCM] requestIgnoreBatteryOptimizations error:", e);
  }
}

export function areNativeNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return (window as any).FormbharoNativeBridge?.areNotificationsEnabled?.() ?? true;
  } catch {
    return true;
  }
}

export function openNativeNotificationSettings(): void {
  if (typeof window === "undefined") return;
  try {
    (window as any).FormbharoNativeBridge?.openNotificationSettings?.();
  } catch (e) {
    console.warn("[FCM] openNotificationSettings error:", e);
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

export function requestNativeNotificationPermission(): void {
  if (typeof window === "undefined") return;
  try {
    (window as any).FormbharoNativeBridge?.requestNotificationPermission?.();
  } catch (e) {
    console.warn("[FCM] requestNativeNotificationPermission error:", e);
  }
}

/**
 * Displays a system top notification in the Android notification bar (via native bridge)
 * or falls back to Web Notification API on desktop browser if permitted.
 */
export function showSystemNotification(
  title: string,
  body: string,
  options?: {
    data?: Record<string, string>;
    onClick?: () => void;
  },
): void {
  // 1. Android Capacitor: invoke native bridge to post directly into the Android notification bar!
  if (typeof window !== "undefined" && (window as any).FormbharoNativeBridge?.postSystemNotification) {
    try {
      const route = options?.data?.route || (options?.data?.requestId ? `/app/chats/${options.data.requestId}` : "");
      const requestId = options?.data?.requestId || "";
      (window as any).FormbharoNativeBridge.postSystemNotification(
        title,
        body,
        route,
        requestId,
      );
      return;
    } catch (e) {
      console.warn("[FCM] Native bridge postSystemNotification error:", e);
    }
  }

  // 2. Web browser fallback
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
  // 1. Check in-memory global token from native bridge broadcast
  if (typeof window !== "undefined") {
    const winToken = (window as any).__FORMBHARO_FCM_TOKEN__;
    if (winToken && typeof winToken === "string" && winToken.trim().length > 0) {
      return winToken.trim();
    }
  }

  // 2. First check FormbharoNativeBridge (instant, synchronous Android Java access)
  if (typeof window !== "undefined") {
    try {
      const nativeToken = (window as any).FormbharoNativeBridge?.getFcmToken?.();
      if (nativeToken && typeof nativeToken === "string" && nativeToken.trim().length > 0) {
        (window as any).__FORMBHARO_FCM_TOKEN__ = nativeToken.trim();
        console.log("[FCM] Obtained token from FormbharoNativeBridge:", nativeToken.substring(0, 10) + "...");
        return nativeToken.trim();
      }
    } catch (e) {
      console.warn("[FCM] FormbharoNativeBridge getFcmToken error:", e);
    }
  }

  // 3. Query @capacitor-firebase/messaging plugin with retries
  const result = await getMessagingPlugin();
  if (result) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const { token } = await result.plugin.getToken({});
        if (token && token.trim().length > 0) {
          if (typeof window !== "undefined") {
            (window as any).__FORMBHARO_FCM_TOKEN__ = token.trim();
          }
          return token.trim();
        }
      } catch (e) {
        console.warn(`[FCM] getToken attempt ${attempt} error:`, e);
      }
      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }

  // 4. Fallback: Re-check bridge after delay in case Firebase async task just completed
  if (typeof window !== "undefined") {
    try {
      const nativeToken = (window as any).FormbharoNativeBridge?.getFcmToken?.();
      if (nativeToken && typeof nativeToken === "string" && nativeToken.trim().length > 0) {
        (window as any).__FORMBHARO_FCM_TOKEN__ = nativeToken.trim();
        return nativeToken.trim();
      }
    } catch {}
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
  if (!userId || !token) return;
  const deviceId = getDeviceId();
  const platform = isCapacitorAndroid() ? "android" : "web";

  let attempts = 3;
  while (attempts > 0) {
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

    if (!error) {
      console.log("[FCM] Token saved for device:", deviceId);
      try {
        localStorage.setItem("formbhro:fcm_saved_token", token);
        localStorage.setItem("formbhro:fcm_saved_user", userId);
      } catch {}
      return;
    }

    console.warn(`[FCM] Failed to save token (attempt ${4 - attempts}):`, error.message);
    attempts--;
    if (attempts > 0) {
      await new Promise((r) => setTimeout(r, 800));
    }
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
let tokenRefreshListenerCleanup: (() => void) | null = null;
let fcmInitializedUserId: string | null = null;
let fcmInitializingPromise: Promise<boolean> | null = null;

/**
 * Registers a listener for foreground notifications (app is open).
 */
export async function onForegroundNotification(
  onNotification: (title: string, body: string, data?: Record<string, string>) => void,
): Promise<() => void> {
  foregroundListenerCleanup?.();
  foregroundListenerCleanup = null;

  const result = await getMessagingPlugin();
  if (!result) return () => {};

  try {
    const handle = await result.plugin.addListener(
      "notificationReceived",
      (payload: FCMNotificationPayload | FCMActionPayload) => {
        const notifPayload = payload as FCMNotificationPayload;
        const n = notifPayload.notification;
        const data = notifPayload.data;
        const title = n?.title || data?.title || "Formbhro";
        const body = n?.body || data?.body || "";
        onNotification(title, body, data);
      },
    );

    const cleanup = () => {
      handle.remove();
      if (foregroundListenerCleanup === cleanup) {
        foregroundListenerCleanup = null;
      }
    };
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
  tapListenerCleanup?.();
  tapListenerCleanup = null;

  const result = await getMessagingPlugin();
  if (!result) return () => {};

  try {
    const handle = await result.plugin.addListener(
      "notificationActionPerformed",
      (payload: FCMNotificationPayload | FCMActionPayload) => {
        const actionPayload = payload as FCMActionPayload;
        const notifPayload = payload as FCMNotificationPayload;
        const data = actionPayload.notification?.data ?? notifPayload.data;
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

    const cleanup = () => {
      handle.remove();
      if (tapListenerCleanup === cleanup) {
        tapListenerCleanup = null;
      }
    };
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
  tokenRefreshListenerCleanup?.();
  foregroundListenerCleanup = null;
  tapListenerCleanup = null;
  tokenRefreshListenerCleanup = null;
}

/**
 * Resets FCM initialization state (called on sign out).
 */
export function resetFCMInitialization(): void {
  cleanupFCMListeners();
  fcmInitializedUserId = null;
  fcmInitializingPromise = null;
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

  if (fcmInitializedUserId === userId) {
    return true;
  }

  if (fcmInitializingPromise) {
    return fcmInitializingPromise;
  }

  fcmInitializingPromise = (async () => {
    try {
      // 1. Setup Android Notification Channels with High Importance
      try {
        await setupAndroidNotificationChannels();
      } catch (e) {
        console.warn("[FCM] Channel setup error:", e);
      }

      // 2. Request permission asynchronously (do not block token retrieval)
      try {
        void requestNotificationPermission();
      } catch (e) {
        console.warn("[FCM] Permission request error:", e);
      }

      // 3. Attach native event listener so any subsequent token ready broadcast persists immediately
      if (typeof window !== "undefined") {
        const onTokenReady = (evt: Event) => {
          const readyToken = (evt as CustomEvent)?.detail?.token;
          if (readyToken && typeof readyToken === "string" && readyToken.trim().length > 0) {
            void saveFCMToken(userId, readyToken.trim());
          }
        };
        window.addEventListener("formbhro:fcm_token_ready", onTokenReady);
      }

      // 4. Retrieve and save token ALWAYS (FCM token generation does not require notification permission)
      let token = await getFCMToken();
      if (!token) {
        // Asynchronous poll for up to 10 seconds in background
        setTimeout(async () => {
          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            const retryToken = await getFCMToken();
            if (retryToken) {
              await saveFCMToken(userId, retryToken);
              fcmInitializedUserId = userId;
              console.log("[FCM] Delayed background token acquisition successful for:", userId);
              break;
            }
          }
        }, 500);
        return false;
      }

      await saveFCMToken(userId, token);
      fcmInitializedUserId = userId;
      console.log("[FCM] Successfully saved FCM token for user:", userId);

      // 5. Listen for token refresh events and persist automatically
      try {
        const result = await getMessagingPlugin();
        if (result && (result.plugin as any).addListener) {
          tokenRefreshListenerCleanup?.();
          tokenRefreshListenerCleanup = null;

          const handle = await (result.plugin as any).addListener(
            "tokenReceived",
            async (event: { token: string }) => {
              if (event?.token) {
                console.log(
                  "[CALL][FCM] Refreshed token received:",
                  event.token.substring(0, 10) + "...",
                );
                await saveFCMToken(userId, event.token);
              }
            },
          );
          tokenRefreshListenerCleanup = () => handle?.remove?.();
        }
      } catch (err) {
        console.warn("[FCM] Could not register tokenReceived listener:", err);
      }

      fcmInitializedUserId = userId;
      return true;
    } finally {
      fcmInitializingPromise = null;
    }
  })();

  return fcmInitializingPromise;
}
