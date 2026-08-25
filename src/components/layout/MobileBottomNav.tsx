import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageSquareText, FileText, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAddDocument } from "@/components/layout/FillNowProvider";

const LEFT = [
  { label: "Home", to: "/app", icon: Home, exact: true },
  { label: "Chats", to: "/app/chats", icon: MessageSquareText, exact: false },
] as const;

const RIGHT = [
  { label: "Documents", to: "/app/documents", icon: FileText, exact: false },
  { label: "Profile", to: "/app/profile", icon: User, exact: false },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { openAddDocument } = useAddDocument();
  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

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
          "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors duration-200",
          active ? "text-brand font-bold" : "text-text-secondary",
        )}
      >
        <Icon
          className={cn("h-6 w-6", active ? "text-brand" : "text-text-secondary")}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.5)]"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 py-2">
        {LEFT.map((i) => (
          <Item key={i.to} {...i} />
        ))}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openAddDocument}
            aria-label="Add Document"
            className="-mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-dark to-brand-light text-white shadow-[0_10px_24px_-10px_rgba(255,122,0,0.9)] transition-transform duration-200 active:scale-95"
          >
            <Plus className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
          </button>
        </div>
        {RIGHT.map((i) => (
          <Item key={i.to} {...i} />
        ))}
      </div>
    </nav>
  );
}
