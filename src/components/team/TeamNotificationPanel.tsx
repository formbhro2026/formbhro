import { BellOff, Check, CheckCheck, FileText, MessageSquareText, RefreshCw, ShieldCheck, Trash2, Undo2, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { useTeamStore } from "@/lib/team-store";
import type { TeamNotification } from "@/data/team-module";
import { cn } from "@/lib/utils";

const ICONS = {
  assigned: UserPlus,
  message: MessageSquareText,
  document: FileText,
  status: RefreshCw,
  admin: ShieldCheck,
} as const;

export function TeamNotificationPanel({ onClose }: { onClose: () => void }) {
  const {
    notifications,
    unreadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    markNotificationUnread,
    clearNotifications,
  } = useTeamStore();
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const list = useMemo(
    () => (tab === "unread" ? notifications.filter((n) => !n.read) : notifications),
    [notifications, tab]
  );

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
      className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-subtle bg-bg shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-white">
          Notifications
          {unreadNotifications > 0 && (
            <span className="ml-2 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadNotifications}</span>
          )}
        </h2>
        <button type="button" onClick={onClose} className="text-[11px] font-semibold text-brand-light hover:underline">
          Close
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        {(["all", "unread"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-8 rounded-full border px-2.5 text-[11px] font-semibold capitalize transition-colors",
              tab === key ? "border-brand/40 bg-brand/10 text-brand-light" : "border-border-strong px-2.5 text-text-secondary hover:bg-white/5"
            )}
          >
            {key}
            {key === "unread" && unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
          </button>
        ))}
        <button
          type="button"
          onClick={markAllNotificationsRead}
          disabled={unreadNotifications === 0}
          className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border-strong px-2.5 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Mark all read
        </button>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <BellOff className="h-6 w-6 text-text-muted" aria-hidden="true" />
          <p className="text-xs text-text-secondary">
            {tab === "unread" ? "No unread notifications." : "You're all caught up."}
          </p>
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {list.map((n: TeamNotification) => {
            const Icon = ICONS[n.type];
            const body = (
              <span className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface-2">
                  <Icon className="h-3.5 w-3.5 text-brand" aria-hidden="true" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-xs leading-relaxed", n.read ? "text-text-secondary" : "text-white")}>{n.text}</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">{n.time}</span>
                </span>
                {!n.read && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
              </span>
            );
            return (
              <li key={n.id} className={cn("border-b border-border-strong/20 last:border-0", !n.read && "bg-brand/5")}>
                <div className="flex items-start gap-1 pr-2">
                  {n.requestId ? (
                    <Link
                      to="/team/work"
                      search={{ r: n.requestId }}
                      onClick={() => {
                        markNotificationRead(n.id);
                        onClose();
                      }}
                      className="min-w-0 flex-1 px-4 py-3 transition-colors hover:bg-white/5"
                    >
                      {!n.read && <span className="sr-only">Unread. </span>}
                      {body}
                    </Link>
                  ) : (
                    <div className="min-w-0 flex-1 px-4 py-3">
                      {!n.read && <span className="sr-only">Unread. </span>}
                      {body}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => (n.read ? markNotificationUnread(n.id) : markNotificationRead(n.id))}
                    aria-label={n.read ? `Mark notification as unread: ${n.text}` : `Mark notification as read: ${n.text}`}
                    title={n.read ? "Mark as unread" : "Mark as read"}
                    className="mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {n.read ? <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {notifications.length > 0 && (
        <div className="border-t border-border-subtle px-3 py-2">
          <button
            type="button"
            onClick={clearNotifications}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
