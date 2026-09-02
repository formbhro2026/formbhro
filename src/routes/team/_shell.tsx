import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTeamStore } from "@/lib/team-store";
import { TeamSidebar } from "@/components/team/TeamSidebar";
import { TeamBottomNav } from "@/components/team/TeamBottomNav";
import { GlobalCallProvider } from "@/lib/call-store";

function TeamShell() {
  const { member, hydrated } = useTeamStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !member) navigate({ to: "/team/login", replace: true });
  }, [hydrated, member, navigate]);

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

  return (
    <GlobalCallProvider>
      <div className="min-h-screen bg-bg text-text antialiased">
        <TeamSidebar />
        <div className="flex min-h-screen flex-col lg:pl-60">
          <Outlet />
        </div>
        <TeamBottomNav />
      </div>
    </GlobalCallProvider>
  );
}

export const Route = createFileRoute("/team/_shell")({
  ssr: false,
  component: TeamShell,
});
