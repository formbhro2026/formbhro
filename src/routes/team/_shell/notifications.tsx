import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team/_shell/notifications")({
  component: TeamNotifications,
  head: () => ({
    meta: [
      { title: "Notifications — Formbhro Team" },
      {
        name: "description",
        content: "Your real-time notifications for assigned Formbhro requests.",
      },
      { property: "og:title", content: "Notifications — Formbhro Team" },
      { property: "og:description", content: "Stay updated with real-time alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function TeamNotifications() {
  const { notifications, markNotificationRead, clearNotifications } = useTeamStore();

  return (
    <>
      <TeamHeader title="Notifications" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">Notifications</h2>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearNotifications}
              className="text-xs font-semibold text-brand-light hover:text-white"
            >
              Clear all
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="mt-5">
            <EmptyState icon={Bell} title="No notifications." description="You're all caught up!" />
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                  n.read ? "border-white/5 bg-surface-1" : "border-brand/20 bg-brand/[0.03]",
                )}
              >
                <div
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    n.read ? "bg-white/20" : "bg-brand",
                  )}
                />
                <div className="min-w-0 flex-1">
                  {n.requestId ? (
                    <Link
                      to="/team/work"
                      search={{ r: n.requestId }}
                      onClick={() => markNotificationRead(n.id)}
                      className={cn(
                        "text-xs leading-relaxed hover:underline block",
                        n.read ? "text-text-muted" : "text-white font-medium",
                      )}
                    >
                      {n.text}
                    </Link>
                  ) : (
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        n.read ? "text-text-muted" : "text-white font-medium",
                      )}
                    >
                      {n.text}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-text-muted">{n.time}</p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(n.id)}
                    className="shrink-0 text-[10px] font-semibold text-brand-light hover:text-white"
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
