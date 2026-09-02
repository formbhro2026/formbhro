import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { SessionProvider, useSession } from "@/lib/session";
import { ModernAuthForm } from "@/components/auth/ModernAuthForm";
import { supabase } from "@/integrations/supabase/client";
import { isCapacitor } from "@/lib/fcm";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect_to?: string; source?: string } => ({
    ...(search.redirect_to !== undefined ? { redirect_to: String(search.redirect_to) } : {}),
    ...(search.source !== undefined ? { source: String(search.source) } : {}),
  }),
  component: () => (
    <SessionProvider>
      <AuthPage />
    </SessionProvider>
  ),
  head: () => ({
    meta: [
      { title: "Sign in to Formbhro — Real-Time Form Assistance" },
      {
        name: "description",
        content:
          "Sign in to start a real Formbhro request, chat with an expert and track your documents live.",
      },
      { property: "og:title", content: "Sign in to Formbhro" },
      {
        property: "og:description",
        content: "Email and phone sign-in for Formbhro users. Team members sign in at /team/login.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AuthPage() {
  const { loading, initialized, user, role, refresh } = useSession();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [authSuccess, setAuthSuccess] = useState(false);
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const [appReturnUrl, setAppReturnUrl] = useState<string | null>(null);

  // Handle OAuth callback: when Google redirects back to /auth with tokens in the URL hash or search
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const query = typeof window !== "undefined" ? window.location.search : "";
    const rawParams = hash.startsWith("#")
      ? hash.slice(1)
      : query.startsWith("?")
        ? query.slice(1)
        : "";
    const params = new URLSearchParams(rawParams);
    const accessToken =
      params.get("access_token") || new URLSearchParams(query).get("access_token");
    const refreshToken =
      params.get("refresh_token") || new URLSearchParams(query).get("refresh_token");

    // Only route to native deep link if explicitly requested from an external browser intent
    // and NOT when running inside the Capacitor WebView itself
    const isInsideApp = isCapacitor();
    const isExplicitAppSource =
      (search.source === "app" || query.includes("source=app") || hash.includes("source=app")) &&
      !isInsideApp;

    if (accessToken && refreshToken) {
      setProcessingOAuth(true);

      if (isExplicitAppSource) {
        const deepLink = `com.formbhro.app://oauth-callback#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
        setAppReturnUrl(deepLink);

        void supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        window.location.href = deepLink;
        setProcessingOAuth(false);
        return;
      }

      // Web flow or inside Capacitor WebView
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .then(({ data, error }) => {
          if (error) {
            console.error("[AuthPage] setSession error:", error.message);
          } else if (data?.session) {
            setAuthSuccess(true);
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            void refresh();
          }
        })
        .catch((e: unknown) => {
          console.error("[AuthPage] OAuth exchange failed:", e);
        })
        .finally(() => {
          setProcessingOAuth(false);
        });
      return;
    }

    const code = params.get("code") || new URLSearchParams(query).get("code");

    if (code) {
      setProcessingOAuth(true);
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            console.error("[AuthPage] exchangeCodeForSession error:", error.message);
            // Try getSession fallback
            return supabase.auth.getSession();
          }
          return { data, error: null };
        })
        .then(({ data }) => {
          if (data?.session) {
            if (isExplicitAppSource) {
              const deepLink = `com.formbhro.app://oauth-callback#access_token=${encodeURIComponent(data.session.access_token)}&refresh_token=${encodeURIComponent(data.session.refresh_token)}`;
              setAppReturnUrl(deepLink);
              window.location.href = deepLink;
              return;
            }

            setAuthSuccess(true);
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            return refresh();
          }
        })
        .catch((e: unknown) => {
          console.error("[AuthPage] OAuth exchange failed:", e);
        })
        .finally(() => {
          setProcessingOAuth(false);
        });
      return;
    }

    if (hash.includes("access_token=") || query.includes("access_token=")) {
      setProcessingOAuth(true);
      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (error) {
            console.error("[AuthPage] OAuth callback error:", error.message);
            return;
          }
          if (data?.session) {
            if (isExplicitAppSource) {
              const deepLink = `com.formbhro.app://oauth-callback#access_token=${encodeURIComponent(data.session.access_token)}&refresh_token=${encodeURIComponent(data.session.refresh_token)}`;
              setAppReturnUrl(deepLink);
              window.location.href = deepLink;
              return;
            }

            setAuthSuccess(true);
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            return refresh();
          }
        })
        .catch((e: unknown) => {
          console.error("[AuthPage] OAuth exchange failed:", e);
        })
        .finally(() => {
          setProcessingOAuth(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.source]);

  useEffect(() => {
    // Only auto-redirect when not actively waiting for native app handoff
    if (appReturnUrl) return;
    // Wait for session initialization to complete before acting
    if (!initialized) return;

    if ((user || authSuccess) && !loading) {
      let defaultDest = "/app";
      if (role === "admin") defaultDest = "/admin";
      else if (role === "team") defaultDest = "/team";

      const dest = search.redirect_to ? decodeURIComponent(search.redirect_to) : defaultDest;
      // Use router navigate (not window.location.href) to keep the React tree alive
      // and avoid creating a brand-new SessionProvider that races with the auth state.
      void navigate({ to: dest as "/app" | "/admin" | "/team", replace: true });
    }
  }, [user, authSuccess, loading, initialized, role, search.redirect_to, appReturnUrl, navigate]);

  const handleSuccess = async () => {
    setAuthSuccess(true);
    await refresh();
  };

  // If handing off to the Android app, show dedicated handoff UI with fallback button
  if (appReturnUrl) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 py-8 text-white antialiased">
        <div className="w-full max-w-[400px] text-center rounded-[28px] border border-white/10 bg-[#121212] p-8 shadow-2xl">
          <Loader2 className="h-10 w-10 animate-spin text-brand mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Returning to Formbhro App…</h2>
          <p className="mt-2 text-sm text-gray-400">
            Authentication successful. Redirecting back to your Formbhro app.
          </p>
          <div className="mt-6 space-y-3">
            <a
              href={appReturnUrl}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-brand py-3.5 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] shadow-lg shadow-brand/20 cursor-pointer"
            >
              Open Formbhro App
            </a>
            <button
              type="button"
              onClick={() => {
                setAppReturnUrl(null);
                setAuthSuccess(true);
                void refresh();
              }}
              className="text-xs text-gray-500 hover:text-gray-300 underline cursor-pointer"
            >
              Continue in browser instead
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            If the app didn't open automatically, tap the button above.
          </p>
        </div>
      </main>
    );
  }

  // Show a spinner while we're processing the OAuth token exchange
  if (
    processingOAuth ||
    (loading &&
      (window.location.hash.includes("access_token=") ||
        window.location.search.includes("access_token=")))
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-brand" />
          <p className="text-sm font-medium text-gray-400">Signing you in…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-8 text-white antialiased selection:bg-brand/30">
      {/* Decorative background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full bg-brand/5 blur-[120px]" />
        <div className="absolute -right-[10%] -bottom-[10%] h-[50%] w-[50%] rounded-full bg-brand/10 blur-[120px]" />

        {/* Fine orange lines / grid pattern simulation */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, var(--color-brand) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <ModernAuthForm isLoading={loading} onSuccess={handleSuccess} />
    </main>
  );
}
