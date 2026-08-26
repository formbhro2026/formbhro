import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Briefcase,
  FileText,
  BarChart3,
  User,
  LogOut,
  Bell,
  LifeBuoy,
  ArrowRight,
} from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/lib/team-store";

export const TEAM_NAV = [
  { label: "Home", to: "/team", icon: Home, exact: true },
  { label: "Work Area", to: "/team/work", icon: Briefcase, exact: false },
  { label: "Documents", to: "/team/documents", icon: FileText, exact: false },
  { label: "Progress", to: "/team/progress", icon: BarChart3, exact: false },
  { label: "Notifications", to: "/team/notifications", icon: Bell, exact: false },
  { label: "Profile", to: "/team/profile", icon: User, exact: false },
] as const;

export function TeamSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { member, signOut, totalUnread, requests, unreadNotifications } = useTeamStore();
  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  const pending = requests.filter((r) => r.status === "pending").length;
  const waiting = requests.filter((r) => r.status === "waiting-user").length;
  const completed = requests.filter((r) => r.status === "completed").length;
  const next = requests
    .filter((r) => r.status !== "completed")
    .slice()
    .sort((a, b) => b.unread - a.unread)[0];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 shrink-0 flex-col border-r border-border-subtle bg-bg lg:flex">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/team" aria-label="Formbhro team home">
          <img src={logoAsset.url} alt="Formbhro" width={140} height={40} className="h-7 w-auto" />
        </Link>
      </div>

      <div className="px-3">
        <Link
          to="/team/work"
          search={next ? { r: next.id } : {}}
          className="flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-brand-dark to-brand-light px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.01] active:scale-95"
        >
          <span className="truncate">Continue Work</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      <div className="mx-3 mt-3 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5">
        <p className="truncate text-xs font-semibold text-white">{member?.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-text-muted">{member?.role}</p>
      </div>

      <nav
        aria-label="Team navigation"
        className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto px-3"
      >
        <ul className="space-y-1">
          {TEAM_NAV.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            const badge =
              item.to === "/team/work"
                ? totalUnread
                : item.to === "/team/notifications"
                  ? unreadNotifications
                  : 0;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200",
                    active
                      ? "bg-brand/10 font-semibold text-white"
                      : "font-medium text-text-secondary hover:bg-white/5 hover:text-white",
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
                  {badge > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 rounded-xl border border-brand/25 bg-brand/[0.06] p-3">
          <p className="text-[11px] font-semibold text-brand-light">Today&apos;s Summary</p>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            <SummaryRow label="Assigned Chats" value={requests.length} />
            <SummaryRow label="Pending" value={pending} tone="text-amber-300" />
            <SummaryRow label="Waiting for User" value={waiting} />
            <SummaryRow label="Completed" value={completed} tone="text-emerald-400" />
            <SummaryRow label="Unread Messages" value={totalUnread} tone="text-brand-light" />
          </dl>
        </div>

        <div className="mt-auto space-y-1 border-t border-border-subtle py-4">
          <a
            href="mailto:support@formbhro.com"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:bg-white/5 hover:text-white"
          >
            <LifeBuoy
              className="h-4.5 w-4.5 text-text-muted"
              strokeWidth={1.75}
              aria-hidden="true"
            />{" "}
            Help &amp; Support
          </a>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4.5 w-4.5 text-text-muted" strokeWidth={1.75} aria-hidden="true" />{" "}
            Logout
          </button>
        </div>
      </nav>
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="truncate text-text-secondary">{label}</dt>
      <dd className={cn("shrink-0 font-bold tabular-nums", tone)}>{value}</dd>
    </div>
  );
}
