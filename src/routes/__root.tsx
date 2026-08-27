import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SplashScreen } from "../components/common/SplashScreen";

import {
  onForegroundNotification,
  onNotificationTap,
  cleanupFCMListeners,
  isCapacitor,
} from "../lib/fcm";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Formbhro — Real-Time Form Assistance" },
      {
        name: "description",
        content:
          "Formbhro is your premium platform for real-time form assistance, connecting you with experts for all your documentation needs.",
      },
      { name: "author", content: "Formbhro" },
      { property: "og:title", content: "Formbhro — Real-Time Form Assistance" },
      {
        property: "og:description",
        content:
          "Get expert assistance for your forms in real-time. Fast, secure, and professional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@formbhro" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Formbhro" },
      { name: "theme-color", content: "#050505" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCapacitor()) return;

    // Handle OAuth deep link from system browser for both Warm Start and Cold Start
    const handleOAuthDeepLink = async (rawUrl: string) => {
      if (
        !rawUrl ||
        (!rawUrl.includes("oauth-callback") &&
          !rawUrl.includes("access_token") &&
          !rawUrl.includes("code="))
      )
        return;

      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close().catch(() => {});

        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let authCode: string | null = null;

        // 1. Check hash fragment (e.g. #access_token=...&refresh_token=...)
        const hashIndex = rawUrl.indexOf("#");
        if (hashIndex !== -1) {
          const hashStr = rawUrl.substring(hashIndex + 1);
          const hashParams = new URLSearchParams(hashStr);
          accessToken = hashParams.get("access_token");
          refreshToken = hashParams.get("refresh_token");
          authCode = hashParams.get("code");
        }

        // 2. Check query string fallback (e.g. ?access_token=...&refresh_token=... or ?code=...)
        if (!accessToken || !refreshToken) {
          const queryIndex = rawUrl.indexOf("?");
          if (queryIndex !== -1) {
            const cleanQuery =
              hashIndex !== -1 && hashIndex > queryIndex
                ? rawUrl.substring(queryIndex + 1, hashIndex)
                : rawUrl.substring(queryIndex + 1);
            const searchParams = new URLSearchParams(cleanQuery);
            accessToken = accessToken || searchParams.get("access_token");
            refreshToken = refreshToken || searchParams.get("refresh_token");
            authCode = authCode || searchParams.get("code");
          }
        }

        const { supabase } = await import("../integrations/supabase/client");

        if (accessToken && refreshToken) {
          accessToken = decodeURIComponent(accessToken);
          refreshToken = decodeURIComponent(refreshToken);

          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("[Root] setSession error from deep link:", error.message);
            return;
          }

          if (data?.session) {
            const redirectPath =
              localStorage.getItem("formbhro:redirect") ||
              sessionStorage.getItem("formbhro:redirect") ||
              "/app";
            // Use router navigate to preserve the React tree and avoid recreating
            // the SessionProvider (which caused the double-login screen race).
            void navigate({ to: redirectPath as "/app", replace: true });
          }
        } else if (authCode) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            decodeURIComponent(authCode),
          );
          if (error) {
            console.error("[Root] exchangeCode error from deep link:", error.message);
            return;
          }

          if (data?.session) {
            const redirectPath =
              localStorage.getItem("formbhro:redirect") ||
              sessionStorage.getItem("formbhro:redirect") ||
              "/app";
            // Use router navigate to preserve the React tree and avoid recreating
            // the SessionProvider (which caused the double-login screen race).
            void navigate({ to: redirectPath as "/app", replace: true });
          }
        }
      } catch (e) {
        console.error("[Root] Failed to parse OAuth callback URL:", e);
      }
    };

    import("@capacitor/app").then(({ App }) => {
      // Hardware back button handler for Android
      App.addListener("backButton", ({ canGoBack }) => {
        const path = window.location.pathname;
        if (!canGoBack || path === "/app" || path === "/") {
          App.exitApp();
        } else {
          window.history.back();
        }
      });

      // Warm Start listener
      App.addListener("appUrlOpen", (data) => {
        if (data?.url) void handleOAuthDeepLink(data.url);
      });

      // Cold Start listener
      App.getLaunchUrl()
        .then((launchUrl) => {
          if (launchUrl?.url) void handleOAuthDeepLink(launchUrl.url);
        })
        .catch((e) => {
          console.warn("[Root] getLaunchUrl error:", e);
        });
    });

    // Register FCM foreground notification handler → shows a sonner toast
    void onForegroundNotification((title, body, data) => {
      toast(title, {
        description: body,
        duration: 6000,
        action: data?.requestId
          ? {
              label: "Open chat",
              onClick: () =>
                void navigate({
                  to: "/app/chats/$requestId",
                  params: { requestId: data.requestId },
                }),
            }
          : undefined,
      });
    });

    // Register FCM notification tap handler → navigates to the relevant route
    void onNotificationTap((path) => {
      // Use window.location for a clean navigation (mirrors auth redirect pattern)
      window.location.href = path;
    });

    return () => {
      cleanupFCMListeners();
    };
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <SplashScreen />
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
