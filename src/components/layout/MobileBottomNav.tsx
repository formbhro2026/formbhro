import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageSquareText, FileText, User, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAddDocument } from "@/components/layout/FillNowProvider";

const LEFT = [
  { label: "Home", to: "/app", icon: Home, exact: true },
  { label: "Chats", to: "/app/chats", icon: MessageSquareText, exact: false },
] as const;

const RIGHT = [
  { label: "Documents", to: "/app/documents", icon: FileText, exact: false },
  { label: "Groups", to: "/app/groups", icon: Users, exact: false },
  { label: "Profile", to: "/app/profile", icon: User, exact: false },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { openAddDocument } = useAddDocument();
  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  // Hide the bottom nav on mobile when inside an active chat room to give the chat full screen space
  const isChatRoom = pathname.startsWith("/app/chats/") && pathname !== "/app/chats";
  if (isChatRoom) return null;

  const Item = ({
    label,
    to,
    icon: Icon,
    exact,
  }: {
    label: string;
    to: string;
    icon: typeof Home;
    exact: boolean;
  }) => {
    const active = isActive(to, exact);
    return (
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition-colors duration-200 select-none",
          active ? "text-brand font-bold" : "text-text-secondary hover:text-white",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 transition-transform duration-150 active:scale-90",
            active ? "text-brand stroke-[2.25]" : "text-text-secondary stroke-[1.75]",
          )}
          aria-hidden="true"
        />
        <span className="truncate max-w-full text-center leading-none tracking-tight">
          {label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-1/95 backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.6)]"
    >
      <div className="mx-auto grid max-w-md grid-cols-6 items-end px-1.5 py-1.5">
        {LEFT.map((i) => (
          <Item key={i.to} {...i} />
        ))}
        <div className="flex justify-center items-end pb-0.5">
          <button
            type="button"
            onClick={openAddDocument}
            aria-label="Add Document"
            className="-mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-dark to-brand-light text-white shadow-[0_8px_20px_-6px_rgba(255,122,0,0.85)] transition-transform duration-200 active:scale-95 hover:scale-105"
          >
            <Plus className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
          </button>
        </div>
        {RIGHT.map((i) => (
          <Item key={i.to} {...i} />
        ))}
      </div>
    </nav>
  );
}
