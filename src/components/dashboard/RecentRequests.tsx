import { Link } from "@tanstack/react-router";
import { ChevronRight, MessageSquareText } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import type { SupportRequest } from "@/data/user-module";

export function RecentRequests({ requests }: { requests: SupportRequest[] }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Recent Requests
        </h2>
        <Link
          to="/app/chats"
          className="text-xs font-semibold text-brand-light transition-colors hover:text-brand"
        >
          View All Chats →
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={MessageSquareText}
            title="No requests yet."
            description="Need help with a form? Start your first request."
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-3 cv-auto">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                to="/app/chats/$requestId"
                params={{ requestId: r.id }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/10 bg-surface-1 p-4 transition-colors duration-200 hover:border-white/20 hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-white">{r.title}</h3>
                    {r.unread > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {r.unread}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-text-muted">
                    {r.id} • {r.assignedTo}
                  </p>
                  <p className="mt-1.5 truncate text-xs text-text-secondary">{r.lastMessage}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-[11px] text-text-muted">{r.lastUpdate}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
