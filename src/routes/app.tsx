import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoUserStoreProvider } from "@/lib/user-store";
import { LiveUserStoreProvider } from "@/lib/live-user-store";
import { SessionProvider, useSession } from "@/lib/session";
import { FillNowProvider } from "@/components/layout/FillNowProvider";
import { UserSidebar } from "@/components/layout/UserSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { PolicyInterceptor } from "@/components/auth/PolicyInterceptor";

export const Route = createFileRoute("/app")({
  validateSearch: (search: Record<string, unknown>): { fill?: string | boolean } =>
    search.fill === undefined ? {} : { fill: search.fill as string | boolean },
  component: AppLayout,
});

function AppLayout() {
  return (
    <SessionProvider>
      <PolicyInterceptor>
        <AppShell />
      </PolicyInterceptor>
    </SessionProvider>
  );
}

function AppShell() {
  const { loading, initialized, user, role } = useSession();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const redirectedRef = useRef(false);

  useEffect(() => {
    // Only redirect once the initial session check has completed (initialized=true).
    // This prevents the race where loading=false briefly fires before getSession()
    // resolves, which previously caused a spurious redirect to /auth (double login screen).
    if (!initialized || redirectedRef.current) return;

    if (!user) {
      if (location.pathname.startsWith("/auth")) return;
      redirectedRef.current = true;
      const search = location.searchStr?.startsWith("?")
        ? location.searchStr.slice(1)
        : location.searchStr;
      const redirectTo = encodeURIComponent(location.pathname + (search ? `?${search}` : ""));
      void navigate({ to: "/auth", search: { redirect_to: redirectTo }, replace: true });
      return;
    }

    if (user && role === "admin") {
      void navigate({ to: "/admin", replace: true });
      return;
    }

    if (user && role === "team") {
      void navigate({ to: "/team", replace: true });
      return;
    }

    // Reset so that a subsequent logout can redirect again from a fresh /app visit
    redirectedRef.current = false;
  }, [initialized, user, role, navigate, location.pathname, location.searchStr]);

  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        <span className="sr-only">Loading your workspace</span>
      </div>
    );
  }

  // While redirecting to auth, keep the loader visible so the user doesn't see a flash of the dashboard.
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Redirecting to sign in</span>
      </div>
    );
  }

  // Prevent rendering the User UI while redirecting an admin/team member
  if (role === "admin" || role === "team") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-brand">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const StoreProvider = LiveUserStoreProvider;
  const pathname = location.pathname;
  const isDashboard = pathname === "/app";
  const isChatRoom = pathname.startsWith("/app/chats/");

  return (
    <StoreProvider key={user?.id ?? "demo"}>
      <FillNowProvider>
        <div className={cn("min-h-screen text-white antialiased bg-bg")}>
          <UserSidebar />
          <div className="flex min-h-screen flex-col lg:pl-60">
            <Outlet />
          </div>
          <MobileBottomNav />
        </div>
      </FillNowProvider>
    </StoreProvider>
  );
}
