import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ApiError, type AppRole, type Profile } from "./types";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";

export const NO_PUBLIC_SIGNUP_MESSAGE =
  "Please contact the administrator for your login credentials.";

import { isCapacitor, isCapacitorAndroid } from "../fcm";

const GOOGLE_CLIENT_ID = "417401975573-d2j8qkksdc4acmt2tjgvtk3rj537tfo1.apps.googleusercontent.com";

/** User module — Google login / signup. */
export async function signInWithGoogle(redirectPath: string = "/app") {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("formbhro:redirect", redirectPath);
    localStorage.setItem("formbhro:redirect", redirectPath);
  }

  const isAndroid = isCapacitorAndroid();
  const isCap = isCapacitor();

  // 1. Native Capacitor Google Sign-In attempt (when in native Android container)
  if (isAndroid) {
    console.log("[Auth] Attempting Capacitor Native Auth flow");
    try {
      const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
      await GoogleAuth.initialize({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ["profile", "email"],
        // grantOfflineAccess must be true to receive an idToken on Android
        grantOfflineAccess: true,
      });
      console.log("[Auth] Calling GoogleAuth.signIn()...");
      const googleUser = await GoogleAuth.signIn();
      console.log(
        "[Auth] GoogleAuth.signIn() returned:",
        JSON.stringify(googleUser).substring(0, 100),
      );

      const idToken = googleUser?.authentication?.idToken || (googleUser as any)?.idToken;
      if (idToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });
        if (error) throw error;
        return data;
      }
      console.warn("[Auth] No ID Token from native GoogleAuth, falling back to browser flow.");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("12501") || errMsg.toLowerCase().includes("canceled") || errMsg.toLowerCase().includes("cancelled")) {
        console.log("[Auth] User canceled Google Sign-In.");
        return null;
      }
      console.warn("[Auth] Capacitor Native Google Auth failed, falling back to browser OAuth:", err);
    }
  }

  // 2. Browser / Web OAuth flow via Chrome Custom Tab
  //    Redirect URL: on Android, use the custom scheme (com.formbhro.app://oauth-callback)
  //    registered in AndroidManifest.xml — this is more reliable than HTTPS App Links
  //    because it requires no .well-known/assetlinks.json verification.
  //    On web, use the /auth path on the same origin.
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://formbhro.lovable.app";
  // For Capacitor: use the custom scheme so tokens are delivered to the app directly.
  // For web: use the /auth page on the current origin.
  const redirectUri = isCap ? "com.formbhro.app://oauth-callback" : `${origin}/auth`;

  // If inside Capacitor container, open OAuth in Chrome Custom Tab via @capacitor/browser
  if (isCap) {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        console.warn("[Auth] Supabase OAuth URL generation error:", error.message);
      } else if (data?.url) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: data.url });
        return data;
      }
    } catch (err: unknown) {
      console.warn("[Auth] Capacitor Browser OAuth error, falling back to standard flow:", err);
    }
  }

  // Standard Web OAuth flow: direct to Supabase
  try {
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
  } catch (err: unknown) {
    console.warn("[Auth] Supabase OAuth error, trying Lovable OAuth fallback:", err);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectUri,
      extraParams: {
        project_id: "lovp_6bgg8rpczv88d8258svxwrn79x",
        prompt: "select_account",
      },
    });
    if (result?.error) throw new ApiError(result.error.message || String(result.error));
    return result;
  }
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
        full_name: fullName,
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
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function getMyRole(): Promise<AppRole | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roles = (data ?? []).map((r: { role: AppRole }) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("team")) return "team";
  return roles.length ? "user" : null;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
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
