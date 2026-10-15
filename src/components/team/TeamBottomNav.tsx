import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Briefcase, MessageSquare, FileText, Users, BarChart3, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/lib/team-store";
import { toast } from "sonner";

export function TeamBottomNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const { totalUnread } = useTeamStore();

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  // Hide the bottom nav on mobile when a work chat is open or inside admin-chat to give full screen space
  const isFullScreenChat = (pathname === "/team/work" && !!search.r) || pathname === "/team/admin-chat";
  if (isFullScreenChat) return null;

  return (
    <nav
      aria-label="Team mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-7 px-0.5 py-1">
        {/* 1. Home */}
        <Link
          to="/team"
          aria-current={isActive("/team", true) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[9px] font-medium transition-colors duration-200",
            isActive("/team", true) ? "text-brand font-bold" : "text-text-muted hover:text-white",
          )}
        >
          <Home
            className={cn(
              "h-4.5 w-4.5",
              isActive("/team", true) ? "text-brand" : "text-text-muted",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">Home</span>
        </Link>

        {/* 2. Work */}
        <Link
          to="/team/work"
          aria-current={isActive("/team/work", false) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[9px] font-medium transition-colors duration-200",
            isActive("/team/work", false) ? "text-brand font-bold" : "text-text-muted hover:text-white",
          )}
        >
          <span className="relative">
            <Briefcase
              className={cn(
                "h-4.5 w-4.5",
                isActive("/team/work", false) ? "text-brand" : "text-text-muted",
              )}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {totalUnread > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-brand px-0.5 text-[8px] font-bold text-white">
                {totalUnread}
                <span className="sr-only"> unread messages</span>
              </span>
            )}
          </span>
          <span className="truncate">Work</span>
        </Link>

        {/* 3. Admin */}
        <Link
          to="/team/admin-chat"
          aria-label="Direct Chat with Admin"
          aria-current={isActive("/team/admin-chat", true) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[9px] font-medium transition-colors duration-200",
            isActive("/team/admin-chat", true) ? "text-brand font-bold" : "text-text-muted hover:text-white",
          )}
        >
          <MessageSquare
            className={cn("h-4.5 w-4.5", isActive("/team/admin-chat", true) ? "text-brand" : "text-text-muted")}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">Admin</span>
        </Link>

        {/* 4. Docs */}
        <Link
          to="/team/documents"
          aria-current={isActive("/team/documents", false) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[9px] font-medium transition-colors duration-200",
            isActive("/team/documents", false) ? "text-brand font-bold" : "text-text-muted hover:text-white",
          )}
        >
          <FileText
            className={cn(
              "h-4.5 w-4.5",
              isActive("/team/documents", false) ? "text-brand" : "text-text-muted",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">Docs</span>
        </Link>

        {/* 5. Groups (Dedicated Groups tab immediately to the right of Docs) */}
        <Link
          to="/team/groups"
          aria-current={isActive("/team/groups", false) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[9px] font-medium transition-colors duration-200",
            isActive("/team/groups", false) ? "text-brand font-bold" : "text-text-muted hover:text-white",
          )}
        >
          <Users
            className={cn(
              "h-4.5 w-4.5",
              isActive("/team/groups", false) ? "text-brand" : "text-text-muted",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">Groups</span>
        </Link>

        {/* 6. Progress */}
        <Link
          to="/team/progress"
          aria-current={isActive("/team/progress", false) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[9px] font-medium transition-colors duration-200",
            isActive("/team/progress", false) ? "text-brand font-bold" : "text-text-muted hover:text-white",
          )}
        >
          <BarChart3
            className={cn(
              "h-4.5 w-4.5",
              isActive("/team/progress", false) ? "text-brand" : "text-text-muted",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">Progress</span>
        </Link>

        {/* 7. Profile */}
        <Link
          to="/team/profile"
          aria-current={isActive("/team/profile", false) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[9px] font-medium transition-colors duration-200",
            isActive("/team/profile", false) ? "text-brand font-bold" : "text-text-muted hover:text-white",
          )}
        >
          <User
            className={cn(
              "h-4.5 w-4.5",
              isActive("/team/profile", false) ? "text-brand" : "text-text-muted",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
