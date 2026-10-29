import { supabase } from "@/integrations/supabase/client";
import { ApiError, type AppRole, type Profile } from "./types";

export const NO_PUBLIC_SIGNUP_MESSAGE =
  "Please contact the administrator for your login credentials.";

import { isCapacitor, isCapacitorAndroid } from "../fcm";

const GOOGLE_CLIENT_ID = "111790521008-kdr78o80m6h10voviku4r6uq9iq9nj2v.apps.googleusercontent.com";

/** User module — Google login / signup. */
export async function signInWithGoogle(redirectPath: string = "/app") {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("formbhro:redirect", redirectPath);
    localStorage.setItem("formbhro:redirect", redirectPath);
  }

  const isAndroid = isCapacitorAndroid();

  // 1. First Priority: Native Android Google Sign-In via FormbharoNativeBridge
  if (isAndroid) {
    const bridge = typeof window !== "undefined" ? (window as any).FormbharoNativeBridge : null;
    if (bridge && typeof bridge.startGoogleSignIn === "function") {
      console.log("[Auth] Starting native Google Sign-In via FormbharoNativeBridge...");
      try {
        const authData = await new Promise<any>((resolve, reject) => {
          let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

          const cleanup = () => {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            window.removeEventListener("nativeGoogleAuthSuccess", onSuccess as any);
            window.removeEventListener("nativeGoogleAuthError", onError as any);
            window.removeEventListener("nativeGoogleAuthCancel", onCancel as any);
          };

          const onSuccess = async (e: CustomEvent) => {
            cleanup();
            try {
              const { idToken } = e.detail || {};
              if (!idToken) {
                reject(new ApiError("No ID token returned by native Google Sign-In"));
                return;
              }
              console.log("[Auth] Exchanging native Google idToken with Supabase...");
              const { data, error } = await supabase.auth.signInWithIdToken({
                provider: "google",
                token: idToken,
              });
              if (error) {
                console.error("[Auth] Supabase signInWithIdToken error:", error.message);
                reject(error);
                return;
              }
              if (typeof window !== "undefined") {
                localStorage.setItem("formbhro:last_workspace", "user");
              }
              resolve(data);
            } catch (err) {
              reject(err);
            }
          };

          const onError = (e: CustomEvent) => {
            cleanup();
            const { code, message } = e.detail || {};
            console.error("[Auth] Native Google Auth error:", code, message);
            reject(new ApiError(message || `Google Sign-In error (code ${code})`));
          };

          const onCancel = () => {
            cleanup();
            console.log("[Auth] User cancelled Google account selection.");
            resolve(null);
          };

          window.addEventListener("nativeGoogleAuthSuccess", onSuccess as any);
          window.addEventListener("nativeGoogleAuthError", onError as any);
          window.addEventListener("nativeGoogleAuthCancel", onCancel as any);

          // 2-minute safety timeout
          timeoutTimer = setTimeout(() => {
            cleanup();
            reject(new ApiError("Google Sign-In request timed out. Please try again."));
          }, 120000);

          try {
            bridge.startGoogleSignIn();
          } catch (launchErr) {
            cleanup();
            reject(launchErr);
          }
        });

        if (authData) {
          return authData;
        }
        return null; // user cancelled
      } catch (nativeErr: any) {
        console.warn("[Auth] FormbharoNativeBridge Google Sign-In result:", nativeErr?.message);
        const errMsg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);

        if (
          errMsg.includes("12501") ||
          errMsg.toLowerCase().includes("canceled") ||
          errMsg.toLowerCase().includes("cancelled") ||
          errMsg.toLowerCase().includes("closed")
        ) {
          return null;
        }

        // If it is a configuration or developer error (status 10), surface it directly to the user
        if (errMsg.includes("10") || errMsg.toLowerCase().includes("developer error") || errMsg.includes("SHA-1")) {
          throw new ApiError(errMsg);
        }

        console.warn("[Auth] Native auth failed, attempting fallback OAuth flow:", errMsg);
      }
    }
  }

  // 2. Reliable OAuth flow via In-App Browser (Custom Tabs) on Android and Web
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://formbhro.com";

  // Note: formbhro.com redirects 308 to www.formbhro.com, so preserve origin hostname
  const redirectUri = isAndroid
    ? `${origin}/auth?source=app`
    : `${origin}/auth`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: isAndroid,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw new ApiError(error.message);

  // If running inside Capacitor, open the OAuth URL in In-App Browser (Custom Tabs)
  if (isAndroid && data?.url) {
    try {
      const { Browser } = await import("@capacitor/browser");
      try {
        const finishSub = await Browser.addListener("browserFinished", async () => {
          try {
            finishSub.remove();
          } catch (_) {}
          for (let i = 0; i < 3; i++) {
            const { data: sessData } = await supabase.auth.getSession();
            if (sessData?.session) {
              localStorage.setItem("formbhro:last_workspace", "user");
              window.location.href = "/app";
              break;
            }
            await new Promise((r) => setTimeout(r, 400));
          }
        });
      } catch (_) {}
      await Browser.open({ url: data.url, presentationStyle: "fullscreen" });
    } catch (browserErr) {
      console.warn("[Auth] Browser plugin open failed, falling back to window.location:", browserErr);
      if (typeof window !== "undefined") {
        window.location.href = data.url;
      }
    }
  }

  return data;
}

/** Team & Admin module — email + password only. Accounts are created by the Admin. */
export async function signInWithPassword(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return result;
}

/** User signup with email/password */
export async function signUpWithEmail(email: string, password: string, fullName: string) {
  const result = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        role: "user",
      },
    },
  });
  return result;
}

/** There is no public signup for Team or Admin. */
export function blockedSignup(): never {
  throw new ApiError(NO_PUBLIC_SIGNUP_MESSAGE, "signup_disabled");
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function getMyRole(): Promise<AppRole | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  let uid = sessionData.session?.user?.id;
  if (!uid) {
    const { data: userData } = await supabase.auth.getUser();
    uid = userData.user?.id;
  }
  if (!uid) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roles = (data ?? []).map((r: { role: AppRole }) => r.role);
  const lastWorkspace =
    typeof window !== "undefined" ? localStorage.getItem("formbhro:last_workspace") : null;
  if (lastWorkspace === "team" && roles.includes("team")) return "team";
  if (lastWorkspace === "admin" && roles.includes("admin")) return "admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("team")) return "team";
  return roles.length ? "user" : null;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  let uid = sessionData.session?.user?.id;
  if (!uid) {
    const { data: userData } = await supabase.auth.getUser();
    uid = userData.user?.id;
  }
  if (!uid) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function updateMyProfile(
  patch: Partial<Pick<Profile, "full_name" | "phone" | "avatar_url">>,
) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Not signed in", "unauthenticated");
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", uid)
    .select()
    .single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Session expired. Please sign in again.", "unauthenticated");

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".jpg";
  const path = `${uid}/${crypto.randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });

  if (uploadError) throw new ApiError("Upload failed. Please try again.", "storage_failure");

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export function onAuthChange(cb: (signedIn: boolean) => void) {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      cb(event !== "SIGNED_OUT");
    }
  });
  return () => data.subscription.unsubscribe();
}

/** Names/avatars for assigned team members (RLS allows the requester to read them). */
export async function getProfilesByIds(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0)
    return {} as Record<string, { full_name: string; avatar_url: string | null }>;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", unique);
  if (error) return {} as Record<string, { full_name: string; avatar_url: string | null }>;
  return Object.fromEntries(
    (data ?? []).map((p: Pick<Profile, "id" | "full_name" | "avatar_url">) => [
      p.id,
      { full_name: p.full_name, avatar_url: p.avatar_url },
    ]),
  ) as Record<string, { full_name: string; avatar_url: string | null }>;
}
