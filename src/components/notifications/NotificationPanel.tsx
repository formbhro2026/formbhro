import { useNavigate } from "@tanstack/react-router";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import {
  Bell,
  BellOff,
  CheckCheck,
  FileUp,
  MessageSquareText,
  Megaphone,
  CircleCheck,
  RefreshCw,
} from "lucide-react";
import { useUserStore } from "@/lib/user-store";
import { EmptyState } from "@/components/common/EmptyState";
import type { AppNotification } from "@/data/user-module";

const ICONS = {
  message: MessageSquareText,
  document: FileUp,
  status: RefreshCw,
  completed: CircleCheck,
  announcement: Megaphone,
};

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useUserStore();
  const navigate = useNavigate();
  const panelRef = useDialogA11y<HTMLDivElement>(onClose, { lockScroll: false });

  const go = (n: AppNotification) => {
    if (!n.read) markNotificationRead(n.id);
    onClose();
    if (n.to === "news") navigate({ to: "/app/news" });
    else if (n.requestId)
      navigate({ to: "/app/chats/$requestId", params: { requestId: n.requestId } });
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="fixed inset-x-3 top-[calc(4.25rem+env(safe-area-inset-top))] z-[70] flex max-h-[calc(100dvh-4.25rem-5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 shadow-2xl duration-200 animate-in fade-in slide-in-from-top-2 sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:max-h-[calc(100dvh-6rem)] sm:w-80"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <p className="text-sm font-semibold text-white">Notifications</p>
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark all as read
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="p-3">
            <EmptyState icon={BellOff} title="You're all caught up." />
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto overscroll-contain max-h-[calc(100dvh-13rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[22rem]">
            {notifications.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => go(n)}
                    className="flex w-full items-start gap-3 border-b border-border-subtle px-4 py-3 text-left transition-colors duration-200 hover:bg-white/5"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface-2">
                      <Icon className="h-4 w-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-relaxed text-text-secondary">
                        {n.text}
                      </span>
                      <span className="mt-1 block text-[11px] text-text-muted">{n.time}</span>
                    </span>

                    {!n.read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand">
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
