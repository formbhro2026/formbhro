import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Search, Zap } from "lucide-react";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { ACTIVE_STATUSES, type SupportRequest } from "@/data/user-module";
import { listQuickReplies } from "@/lib/api/notifications";
import type { QuickReplyRow } from "@/lib/api/types";

const FILTERS = ["All", "Active", "Pending", "Completed"] as const;
type Filter = (typeof FILTERS)[number];

export function ChatList({
  requests,
  activeId,
  compact = false,
}: {
  requests: SupportRequest[];
  activeId?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [quickReplies, setQuickReplies] = useState<QuickReplyRow[]>([]);

  useEffect(() => {
    void listQuickReplies().then(setQuickReplies).catch(() => {});
  }, []);

  const isQuickMode = query.startsWith("/");
  const quickFilter = isQuickMode ? query.slice(1).trim().toLowerCase() : "";

  const matchingQuickReplies = useMemo(() => {
    if (!isQuickMode) return [];
    if (!quickFilter) return quickReplies;
    return quickReplies.filter(
      (qr) =>
        qr.title.toLowerCase().includes(quickFilter) ||
        qr.body.toLowerCase().includes(quickFilter),
    );
  }, [isQuickMode, quickFilter, quickReplies]);

  const filtered = useMemo(() => {
    if (isQuickMode) return requests;
    return requests.filter((r) => {
      const matchesQuery =
        !query ||
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.id.toLowerCase().includes(query.toLowerCase()) ||
        r.lastMessage.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        filter === "All" ||
        (filter === "Active" && ACTIVE_STATUSES.includes(r.status) && r.status !== "pending") ||
        (filter === "Pending" && (r.status === "pending" || r.status === "new")) ||
        (filter === "Completed" && r.status === "completed");
      return matchesQuery && matchesFilter;
    });
  }, [requests, query, filter, isQuickMode]);

  return (
    <div className="flex min-h-0 flex-col bg-bg">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations or type '/' for Quick Chats..."
          aria-label="Search conversations"
          className="w-full rounded-2xl border border-border-subtle bg-surface-2 py-3 pl-10 pr-4 text-sm text-white placeholder:text-text-muted focus:border-brand/40 focus:ring-1 focus:ring-brand/10 outline-none transition-all"
        />

        {isQuickMode && (
          <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-xl border border-border-subtle bg-surface-2 p-2 shadow-2xl z-30 space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-brand" /> Quick Custom Chats
            </div>
            {matchingQuickReplies.length === 0 ? (
              <div className="p-3 text-center text-xs text-text-muted">
                No quick custom chats match "{quickFilter}"
              </div>
            ) : (
              matchingQuickReplies.map((qr) => (
                <div
                  key={qr.id}
                  className="rounded-lg p-2.5 hover:bg-surface-3 transition-colors text-left"
                >
                  <div className="text-xs font-bold text-white">{qr.title}</div>
                  <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">{qr.body}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
              filter === f
                ? "border-brand/40 bg-brand/10 text-brand shadow-lg shadow-brand/5"
                : "border-border-subtle text-text-muted hover:border-text-secondary hover:text-white",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "mt-4 min-h-0 space-y-3 cv-auto",
          compact && "overflow-y-auto pr-1 custom-scrollbar",
        )}
      >
        {filtered.length === 0 ? (
          <div className="py-10">
            <EmptyState
              icon={MessageSquareText}
              title="No chats found."
              description="Try a different search or filter to find your conversations."
            />
          </div>
        ) : (
          filtered.map((r) => <ChatListItem key={r.id} request={r} active={r.id === activeId} />)
        )}
      </div>
    </div>
  );
}
