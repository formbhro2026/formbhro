import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  MessageSquareText,
  FileText,
  Newspaper,
  User,
  LifeBuoy,
  LogOut,
  Plus,
} from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { cn } from "@/lib/utils";
import { useAddDocument } from "@/components/layout/FillNowProvider";
import { useUserStore } from "@/lib/user-store";
import { useSession } from "@/lib/session";

export const NAV_ITEMS = [
  { label: "Home", to: "/app", icon: Home, exact: true },
  { label: "My Chats", to: "/app/chats", icon: MessageSquareText, exact: false },
  { label: "My Documents", to: "/app/documents", icon: FileText, exact: false },
  { label: "News & Updates", to: "/app/news", icon: Newspaper, exact: false },
  { label: "Profile", to: "/app/profile", icon: User, exact: false },
] as const;

export function UserSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { openAddDocument } = useAddDocument();
  const { sidebarOpen, setSidebarOpen } = useUserStore();
  const { signOut } = useSession();
  const navigate = useNavigate();
  const logout = async () => {
    await signOut();
    await navigate({ to: "/" });
  };

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-1 transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/app" aria-label="Formbhro home" onClick={() => setSidebarOpen(false)}>
            <img
              src={logoAsset.url}
              alt="Formbhro"
              width={140}
              height={40}
              className="h-7 w-auto hover:opacity-80 transition-opacity"
            />
          </Link>
        </div>

        <div className="px-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              openAddDocument();
              setSidebarOpen(false);
            }}
            aria-haspopup="dialog"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white transition-all duration-200 hover:scale-[1.05] active:scale-95 shadow-lg shadow-brand/25"
            title="Add Document"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>

        <nav aria-label="User navigation" className="mt-5 flex min-h-0 flex-1 flex-col px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.to, item.exact);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200",
                      active
                        ? "bg-brand/10 font-semibold text-brand"
                        : "font-medium text-text-secondary hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand"
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4.5 w-4.5 shrink-0",
                        active ? "text-brand" : "text-text-muted",
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto space-y-1 border-t border-border-subtle py-4 flex flex-col items-center">
            <Link
              to="/app/profile"
              hash="help"
              title="Help & Support"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted hover:text-text transition-all active:scale-90"
            >
              <LifeBuoy className="h-4.5 w-4.5" strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted hover:text-text transition-all active:scale-90"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" strokeWidth={1.75} />
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
