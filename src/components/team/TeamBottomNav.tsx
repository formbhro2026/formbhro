import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Briefcase, MessageSquare, FileText, BarChart3, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/lib/team-store";
import { toast } from "sonner";

export function TeamBottomNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const { totalUnread, openAdminChat, requests } = useTeamStore();
  const [openingChat, setOpeningChat] = useState(false);

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  // Check if admin direct chat is currently selected
  const activeRequestId = search?.r as string | undefined;
  const isAdminChatActive =
    pathname === "/team/work" &&
    Boolean(
      activeRequestId &&
        (activeRequestId.startsWith("ADM-TM") ||
          requests.some(
            (r) =>
              (r.id === activeRequestId || r.id.toLowerCase() === activeRequestId.toLowerCase()) &&
              r.category === "Team Direct Report",
          )),
    );

  const handleOpenAdminChat = async () => {
    setOpeningChat(true);
    try {
      const chatId = await openAdminChat();
      if (chatId) {
        void navigate({ to: "/team/work", search: { r: chatId } });
      }
    } catch (err) {
      console.error("[TeamBottomNav] openAdminChat error:", err);
      toast.error(err instanceof Error ? err.message : "Could not connect to Admin chat");
    } finally {
      setOpeningChat(false);
    }
  };

  // Hide the bottom nav on mobile when a chat is open to give the chat full screen space
  const isWorkChatOpen = pathname === "/team/work" && !!search.r;
  if (isWorkChatOpen) return null;

  return (
    <nav
      aria-label="Team mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-6 px-1 py-1.5">
        {/* 1. Home */}
        <Link
          to="/team"
          aria-current={isActive("/team", true) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition-colors duration-200",
            isActive("/team", true) ? "text-white" : "text-text-muted",
          )}
        >
          <Home
            className={cn(
              "h-5 w-5",
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
          aria-current={isActive("/team/work", false) && !isAdminChatActive ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition-colors duration-200",
            isActive("/team/work", false) && !isAdminChatActive ? "text-white" : "text-text-muted",
          )}
        >
          <span className="relative">
            <Briefcase
              className={cn(
                "h-5 w-5",
                isActive("/team/work", false) && !isAdminChatActive
                  ? "text-brand"
                  : "text-text-muted",
              )}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {totalUnread > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                {totalUnread}
                <span className="sr-only"> unread messages</span>
              </span>
            )}
          </span>
          <span className="truncate">Work</span>
        </Link>

        {/* 3. Admin Chat (between Work and Docs) */}
        <button
          type="button"
          onClick={handleOpenAdminChat}
          disabled={openingChat}
          aria-label="Direct Chat with Admin"
          aria-current={isAdminChatActive ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition-colors duration-200 disabled:opacity-50",
            isAdminChatActive ? "text-white font-semibold" : "text-text-muted",
          )}
        >
          {openingChat ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand" strokeWidth={1.75} />
          ) : (
            <MessageSquare
              className={cn("h-5 w-5", isAdminChatActive ? "text-brand" : "text-text-muted")}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          )}
          <span className="truncate">Admin</span>
        </button>

        {/* 4. Docs */}
        <Link
          to="/team/documents"
          aria-current={isActive("/team/documents", false) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition-colors duration-200",
            isActive("/team/documents", false) ? "text-white" : "text-text-muted",
          )}
        >
          <FileText
            className={cn(
              "h-5 w-5",
              isActive("/team/documents", false) ? "text-brand" : "text-text-muted",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">Docs</span>
        </Link>

        {/* 5. Progress */}
        <Link
          to="/team/progress"
          aria-current={isActive("/team/progress", false) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition-colors duration-200",
            isActive("/team/progress", false) ? "text-white" : "text-text-muted",
          )}
        >
          <BarChart3
            className={cn(
              "h-5 w-5",
              isActive("/team/progress", false) ? "text-brand" : "text-text-muted",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="truncate">Progress</span>
        </Link>

        {/* 6. Profile */}
        <Link
          to="/team/profile"
          aria-current={isActive("/team/profile", false) ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition-colors duration-200",
            isActive("/team/profile", false) ? "text-white" : "text-text-muted",
          )}
        >
          <User
            className={cn(
              "h-5 w-5",
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
