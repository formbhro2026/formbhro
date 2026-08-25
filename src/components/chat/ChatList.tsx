import { useMemo, useState } from "react";
import { MessageSquareText, Search } from "lucide-react";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { ACTIVE_STATUSES, type SupportRequest } from "@/data/user-module";

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

  const filtered = useMemo(() => {
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
  }, [requests, query, filter]);

  return (
    <div className="flex min-h-0 flex-col bg-bg">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="w-full rounded-2xl border border-border-subtle bg-surface-2 py-3 pl-10 pr-4 text-sm text-white placeholder:text-text-muted focus:border-brand/40 focus:ring-1 focus:ring-brand/10 outline-none transition-all"
        />
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
                : "border-border-subtle text-text-muted hover:border-text-secondary hover:text-white"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className={cn("mt-4 min-h-0 space-y-3 cv-auto", compact && "overflow-y-auto pr-1 custom-scrollbar")}>
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
