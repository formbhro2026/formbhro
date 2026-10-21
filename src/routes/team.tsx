import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TeamStoreProvider } from "@/lib/team-store";
import { SessionProvider } from "@/lib/session";

function TeamRoot() {
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
