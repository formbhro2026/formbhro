import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Briefcase, FileText, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/lib/team-store";

const ITEMS = [
  { label: "Home", to: "/team", icon: Home, exact: true },
  { label: "Work", to: "/team/work", icon: Briefcase, exact: false },
  { label: "Docs", to: "/team/documents", icon: FileText, exact: false },
  { label: "Progress", to: "/team/progress", icon: BarChart3, exact: false },
  { label: "Profile", to: "/team/profile", icon: User, exact: false },
] as const;

export function TeamBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const { totalUnread } = useTeamStore();
  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  // Hide the bottom nav on mobile when a chat is open to give the chat full screen space
  const isWorkChatOpen = pathname === "/team/work" && !!search.r;
  if (isWorkChatOpen) return null;

  return (
    <nav
      aria-label="Team mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 py-2">
        {ITEMS.map(({ label, to, icon: Icon, exact }) => {
          const active = isActive(to, exact);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors duration-200",
                active ? "text-white" : "text-text-muted",
              )}
            >
              <span className="relative">
                <Icon
                  className={cn("h-5 w-5", active ? "text-brand" : "text-text-muted")}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {to === "/team/work" && totalUnread > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                    {totalUnread}
                    <span className="sr-only"> unread messages</span>
                  </span>
                )}
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
