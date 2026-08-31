import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AdminSidebar, AdminTopbar, ADMIN_NAV } from "@/components/admin/AdminSidebar";
import { useAdmin } from "@/lib/admin-store";
import { GlobalCallProvider } from "@/lib/call-store";

export const Route = createFileRoute("/admin/_shell")({
  component: AdminShell,
});

function AdminShell() {
  const { ready, authed } = useAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (ready && !authed) navigate({ to: "/admin/login", replace: true });
  }, [ready, authed, navigate]);

  if (!ready || !authed) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg text-white">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
        <span className="sr-only">Loading admin console</span>
      </main>
    );
  }

  const current = [...ADMIN_NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.exact ? pathname === item.to : pathname.startsWith(item.to)));

  return (
    <GlobalCallProvider>
      <div className="min-h-screen bg-bg text-white antialiased">
        <AdminSidebar />
        <div className="lg:pl-60 xl:pl-64">
          <AdminTopbar title={current?.label ?? "Dashboard"} />
          <main className="px-4 py-5 sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </GlobalCallProvider>
  );
}
