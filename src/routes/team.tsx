import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { TeamStoreProvider } from "@/lib/team-store";
import { SessionProvider } from "@/lib/session";

function TeamRoot() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    // If arriving at /team or /team/, immediately forward to /team/work to prevent 404
    if (pathname === "/team" || pathname === "/team/") {
      void navigate({ to: "/team/work", replace: true });
    }
  }, [pathname, navigate]);

  return (
    <SessionProvider>
      <TeamStoreProvider>
        <Outlet />
      </TeamStoreProvider>
    </SessionProvider>
  );
}

export const Route = createFileRoute("/team")({
  ssr: false,
  component: TeamRoot,
});
