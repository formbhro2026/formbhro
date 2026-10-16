import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTeamStore } from "@/lib/team-store";
import { TeamSidebar } from "@/components/team/TeamSidebar";
import { TeamBottomNav } from "@/components/team/TeamBottomNav";
import { GlobalCallProvider } from "@/lib/call-store";
import { updateTeamPresence } from "@/lib/api/requests";
import { cn } from "@/lib/utils";

function TeamShell() {
  const { member, hydrated } = useTeamStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !member) navigate({ to: "/team/login", replace: true });
  }, [hydrated, member, navigate]);

  // Presence heartbeat for team member
  useEffect(() => {
    if (!member?.id) return;

    // Mark online immediately
    void updateTeamPresence("online").catch(() => undefined);

    const interval = setInterval(() => {
      void updateTeamPresence("online").catch(() => undefined);
    }, 25000);

    const handleVisibility = () => {
      if (document.hidden) {
        void updateTeamPresence("away").catch(() => undefined);
      } else {
        void updateTeamPresence("online").catch(() => undefined);
      }
    };

    const handleBeforeUnload = () => {
      void updateTeamPresence("offline").catch(() => undefined);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void updateTeamPresence("offline").catch(() => undefined);
    };
  }, [member?.id]);

  if (!hydrated || !member) {
    return (
      <div
        className="grid min-h-screen place-items-center bg-bg text-xs text-text-muted"
        role="status"
      >
        Loading your workspace…
      </div>
    );
  }

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const isChatRoom =
    (pathname === "/team/work" && (!!search?.r || !!search?.id)) || pathname === "/team/admin-chat";

  return (
    <GlobalCallProvider>
      <div
        className={cn(
          "bg-bg text-text antialiased",
          isChatRoom ? "h-[100dvh] flex flex-col overflow-hidden" : "min-h-screen",
        )}
      >
        <TeamSidebar />
        <div
          className={cn(
            "lg:pl-60",
            isChatRoom ? "flex-1 flex flex-col min-h-0 overflow-hidden" : "flex min-h-screen flex-col",
          )}
        >
          <Outlet />
        </div>
        {!isChatRoom && <TeamBottomNav />}
      </div>
    </GlobalCallProvider>
  );
}

export const Route = createFileRoute("/team/_shell")({
  ssr: false,
  component: TeamShell,
});

