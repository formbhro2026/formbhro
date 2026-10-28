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

  // 1. Native Capacitor Google Sign-In on Android
  // Displays the native Android Google Account Chooser bottom sheet with device accounts
  // so the user selects their account with one tap, without opening a web browser.
  if (isAndroid) {
    console.log("[Auth] Starting native Android Google Sign-In...");
    try {
      const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
      try {
        await GoogleAuth.initialize({
          clientId: GOOGLE_CLIENT_ID,
          serverClientId: GOOGLE_CLIENT_ID,
          scopes: ["profile", "email"],
          grantOfflineAccess: false,
        } as any);
      } catch (initErr) {
        console.warn("[Auth] GoogleAuth.initialize warning (continuing):", initErr);
      }

      console.log("[Auth] Launching native Google account picker dialog...");
      const googleUser = await GoogleAuth.signIn();
      console.log("[Auth] Native account selected:", googleUser?.email || googleUser?.id);

      const idToken =
        googleUser?.authentication?.idToken ||
        (googleUser as any)?.idToken ||
        (googleUser as any)?.authentication?.token;
      const accessToken =
        googleUser?.authentication?.accessToken ||
        (googleUser as any)?.accessToken ||
        (googleUser as any)?.authentication?.access_token;

      if (!idToken) {
        throw new Error("No ID token returned by native Google Sign-In");
      }

      console.log("[Auth] Exchanging native idToken with Supabase...");
      const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        access_token: accessToken || undefined,
      });

      if (authError) {
        console.error("[Auth] Supabase signInWithIdToken error:", authError.message);
        throw authError;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("formbhro:last_workspace", "user");
      }
      return authData;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[Auth] Native Google Auth result/error:", errMsg);

      // Handle user cancellation (12501 or user dismissed account chooser)
      if (
        errMsg.includes("12501") ||
        errMsg.toLowerCase().includes("canceled") ||
        errMsg.toLowerCase().includes("cancelled") ||
        errMsg.toLowerCase().includes("closed")
      ) {
        console.log("[Auth] User canceled Google account selection.");
        return null;
      }

      // Re-throw so the UI displays the error rather than launching a broken web browser
      throw new ApiError(errMsg || "Google Sign-In failed. Please try again.");
    }
  }

  // 2. Web browser OAuth flow (used on Web desktop/mobile browsers)
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://formbhro.com";

  const redirectUri = `${origin}/auth`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUri,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw new ApiError(error.message);
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
