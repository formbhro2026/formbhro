import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TeamStoreProvider } from "@/lib/team-store";

export const Route = createFileRoute("/team")({
  component: () => (
    <TeamStoreProvider>
      <Outlet />
    </TeamStoreProvider>
  ),
});
