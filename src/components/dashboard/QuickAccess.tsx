import { Link } from "@tanstack/react-router";
import { FileText, LifeBuoy, MessageSquareText, Newspaper } from "lucide-react";

const ITEMS = [
  { label: "My Chats", to: "/app/chats", icon: MessageSquareText },
  { label: "My Documents", to: "/app/documents", icon: FileText },
  { label: "News & Updates", to: "/app/news", icon: Newspaper },
  { label: "Help & Support", to: "/app/profile", icon: LifeBuoy },
] as const;

export function QuickAccess() {
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Quick Access
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ITEMS.map((i) => {
          const Icon = i.icon;
          return (
            <li key={i.label}>
              <Link
                to={i.to}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-surface-1 px-3 py-3 transition-colors duration-200 hover:border-white/20 hover:bg-surface-2"
              >
                <Icon
                  className="h-4 w-4 shrink-0 text-brand"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="truncate text-xs font-medium text-white">{i.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
