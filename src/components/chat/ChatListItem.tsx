import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";
import type { SupportRequest } from "@/data/user-module";

export function ChatListItem({ request, active = false }: { request: SupportRequest; active?: boolean }) {
  return (
    <Link
      to="/app/chats/$requestId"
      params={{ requestId: request.id }}
      aria-label={`Chat for ${request.title}, status ${request.status}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-4 transition-all duration-200",
        active
          ? "border-brand/40 bg-brand/10 shadow-lg shadow-brand/5"
          : "border-border-subtle bg-surface-1 hover:border-text-muted hover:bg-surface-2"
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className={cn(
            "truncate text-sm font-bold transition-colors",
            active ? "text-white" : "text-white group-hover:text-brand"
          )}>{request.title}</h3>
          {request.unread > 0 && (
            <span className="inline-flex shrink-0 items-center justify-center h-5 w-5 rounded-full bg-brand text-[10px] font-bold text-white shadow-lg shadow-brand/20">
              {request.unread}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[10px] font-bold text-text-muted uppercase tracking-wider">{request.reference || request.id}</p>
        <p className="mt-2 truncate text-[12px] font-medium text-text-secondary">
          <span className="text-brand font-bold">{request.assignedTo}:</span> {request.lastMessage}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={request.status} />
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">{request.lastUpdate}</span>
        </div>
      </div>
      <ChevronRight className={cn(
        "h-5 w-5 shrink-0 transition-all",
        active ? "text-brand" : "text-text-muted"
      )} aria-hidden="true" />
    </Link>
  );
}
