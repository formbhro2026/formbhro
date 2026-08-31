import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TeamStoreProvider } from "@/lib/team-store";
import { SessionProvider } from "@/lib/session";

export const Route = createFileRoute("/team")({
  component: () => (
    <SessionProvider>
      <TeamStoreProvider>
        <Outlet />
      </TeamStoreProvider>
    </SessionProvider>
  ),
});
