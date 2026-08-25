import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminProvider } from "@/lib/admin-store";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminRoot,
  head: () => ({
    meta: [
      { title: "Super Admin — Formbhro" },
      { name: "description", content: "Formbhro super admin console for users, team, requests, chats and analytics." },
      { property: "og:title", content: "Super Admin — Formbhro" },
      { property: "og:description", content: "Manage the whole Formbhro platform from one live console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminRoot() {
  return (
    <AdminProvider>
      <Outlet />
    </AdminProvider>
  );
}
