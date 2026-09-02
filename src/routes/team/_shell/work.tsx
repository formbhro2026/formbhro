import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { canShareScreen } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  Info,
  Eye,
  MessageSquareText,
  Paperclip,
  Pencil,
  History,
  Undo2,
  ChevronDown,
  ChevronUp,
  SmilePlus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  X,
  Pin,
  PinOff,
  Phone,
  Video,
  Monitor,
  FileText,
} from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamStatusBadge, PriorityBadge } from "@/components/team/TeamStatusBadge";
import { Button } from "@/components/admin/AdminUI";
import { StatusSelect } from "@/components/team/StatusSelect";
import { CategorySelect } from "@/components/team/CategorySelect";
import { TeamDocumentCard } from "@/components/team/TeamDocumentCard";
import { TeamDocumentPreview } from "@/components/team/TeamDocumentPreview";
import { CallEventBubble } from "@/components/chat/CallEventBubble";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import type { TeamDelivery, Priority, TeamMessage } from "@/data/team-module";
import { WorkFilters } from "@/components/team/WorkFilters";
import { MessageAttachment } from "@/components/team/MessageAttachment";
import { TransferButton, EscalateButton } from "@/components/team/TransferModal";
import { ChatTagButton, ChatTagBadges } from "@/components/team/ChatTagModal";

import { useVisualViewport } from "@/lib/use-visual-viewport";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { formatBytes, kindFromFile } from "@/lib/team-files";
import type { TeamRequest } from "@/data/team-module";
import { cn } from "@/lib/utils";
import { useWebRTCCall } from "@/hooks/use-webrtc-call";
import { CallOverlay } from "@/components/chat/CallOverlay";
import { listQuickReplies } from "@/lib/api/notifications";
import type { QuickReplyRow } from "@/lib/api/types";
import { Zap } from "lucide-react";

type WorkSearch = {
  r?: string;
  q?: string;
  f?: string;
  u?: string;
  rid?: string;
  t?: string;
  p?: string;
  tag?: string;
  sort?: string;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/team/_shell/work")({
  validateSearch: (search: Record<string, unknown>): WorkSearch => ({
    r: str(search.r),
    q: str(search.q),
    f: search.f === "pending" || search.f === "completed" ? search.f : undefined,
    u: str(search.u),
    rid: str(search.rid),
    t: str(search.t),
    tag: str(search.tag),
    p: search.p === "low" || search.p === "medium" || search.p === "high" ? search.p : undefined,
    sort: search.sort === "oldest" ? "oldest" : undefined,
  }),
  component: WorkArea,
  head: () => ({
    meta: [
      { title: "Work Area — Formbhro Team" },
      {
        name: "description",
        content:
          "Handle every assigned Formbhro conversation, share documents and update request status.",
      },
      { property: "og:title", content: "Work Area — Formbhro Team" },
      {
        property: "og:description",
        content: "Your assigned conversations, documents and request details in one screen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function WorkArea() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const {
    requests,
    pool,
    requestsHasMore,
    requestsLoadingMore,
    loadMoreRequests,
    messagesFor,
    documentsFor,
    getDocument,
    sendMessage,
    attachDocument,
    deleteDocument,
    setStatus,
    markRead,
    assignToMe,
  } = useTeamStore();
  const { height: viewportHeight } = useVisualViewport();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const query = search.q ?? "";
  const state = (search.f as "pending" | "completed" | undefined) ?? "all";
  const priority = (search.p as Priority | undefined) ?? "all";
  const userFilter = search.u ?? "";
  const ridFilter = search.rid ?? "";
  const typeFilter = search.t ?? "";
  const sort = (search.sort as "oldest" | undefined) ?? "newest";

  const setSearch = (patch: WorkSearch) =>
    navigate({
      to: "/team/work",
      search: (prev: WorkSearch) => ({ ...prev, ...patch }),
      replace: true,
    });

  const tagFilter = search.tag;

  const users = useMemo(
    () => Array.from(new Set(requests.map((r) => r.userName))).sort(),
    [requests],
  );
  const types = useMemo(
    () => Array.from(new Set(requests.map((r) => r.category))).sort(),
    [requests],
  );
  const allTags = useMemo(
    () => Array.from(new Set(requests.flatMap((r) => r.tags ?? []))).sort(),
    [requests],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rid = ridFilter.trim().toLowerCase();
    let out = requests.filter((r) => {
      if (state === "pending" && r.status === "completed") return false;
      if (state === "completed" && r.status !== "completed") return false;
      if (priority !== "all" && r.priority !== priority) return false;
      if (userFilter && r.userName !== userFilter) return false;
      if (typeFilter && r.category !== typeFilter) return false;
      if (tagFilter && (!r.tags || !r.tags.includes(tagFilter))) return false;
      if (rid && !r.id.toLowerCase().includes(rid)) return false;
      if (!q) return true;
      return `${r.userName} ${r.id} ${r.category} ${r.title} ${(r.tags ?? []).join(" ")}`.toLowerCase().includes(q);
    });
    out = out
      .slice()
      .sort((a, b) =>
        sort === "oldest"
          ? a.createdOn.localeCompare(b.createdOn)
          : b.createdOn.localeCompare(a.createdOn),
      );
    return out;
  }, [requests, query, state, priority, userFilter, typeFilter, tagFilter, ridFilter, sort]);

  const listUnread = useMemo(() => list.reduce((sum, r) => sum + r.unread, 0), [list]);

  const selected = search.r
    ? (requests.find(
        (r) =>
          r.id === search.r ||
          r.id.toLowerCase() === search.r.toLowerCase() ||
          r.id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ===
            search.r.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
      ) ?? null)
    : null;

  // Leaving a chat clears anything the member scrolled past but never reached.
  const openIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = openIdRef.current;
    if (previous && previous !== selected?.id) markRead(previous);
    openIdRef.current = selected?.id ?? null;
  }, [selected, markRead]);

  const preview = previewId ? (getDocument(previewId) ?? null) : null;

  return (
    <>
      <div className={cn("lg:block", selected && "hidden")}>
        <TeamHeader title="Work Area" />
      </div>

      <div
        className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,20rem)]"
        style={
          selected && viewportHeight
            ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` }
            : undefined
        }
      >
        {/* LEFT — assigned chat list */}
        <section
          aria-label="Assigned conversations"
          className={cn(
            "flex min-h-0 flex-col border-r border-border-subtle bg-surface-1 pb-24 lg:pb-0",
            selected ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="flex flex-col gap-4 border-b border-border-subtle bg-surface-2 p-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Request Pool
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {pool.length === 0 ? (
                <p className="text-[10px] text-text-muted italic">No unassigned requests.</p>
              ) : (
                pool.map((r: TeamRequest) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border-subtle bg-surface-1 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-semibold text-white">{r.title}</p>
                      <button
                        onClick={async () => {
                          if (claimingId) return;
                          setClaimingId(r.id);
                          try {
                            await assignToMe(r.id);
                          } catch {
                            // Handled by store toast
                          } finally {
                            setClaimingId(null);
                          }
                        }}
                        disabled={claimingId !== null}
                        className="shrink-0 rounded bg-brand/10 px-2 py-0.5 text-[9px] font-bold text-brand-light hover:bg-brand/20 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {claimingId === r.id && (
                          <div className="h-2 w-2 animate-spin rounded-full border border-brand-light border-t-transparent" />
                        )}
                        Claim
                      </button>
                    </div>
                    <p className="mt-0.5 text-[9px] text-text-muted">
                      {r.id} • {r.category}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <WorkFilters
            values={{
              q: query,
              user: userFilter,
              rid: ridFilter,
              type: typeFilter,
              tag: tagFilter,
              state,
              priority,
              sort,
            }}
            users={users}
            types={types}
            tags={allTags}
            shown={list.length}
            total={requests.length}
            onChange={(patch) =>
              setSearch({
                ...("q" in patch ? { q: patch.q || undefined } : {}),
                ...("user" in patch ? { u: patch.user || undefined } : {}),
                ...("rid" in patch ? { rid: patch.rid || undefined } : {}),
                ...("type" in patch ? { t: patch.type || undefined } : {}),
                ...("tag" in patch ? { tag: patch.tag || undefined } : {}),
                ...("state" in patch ? { f: patch.state === "all" ? undefined : patch.state } : {}),
                ...("priority" in patch
                  ? { p: patch.priority === "all" ? undefined : patch.priority }
                  : {}),
                ...("sort" in patch
                  ? { sort: patch.sort === "oldest" ? "oldest" : undefined }
                  : {}),
              })
            }
            onReset={() =>
              setSearch({
                q: undefined,
                u: undefined,
                rid: undefined,
                t: undefined,
                tag: undefined,
                f: undefined,
                p: undefined,
              })
            }
          />

          {listUnread > 0 && (
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
              <p className="text-[11px] text-text-muted">
                {listUnread} unread {listUnread === 1 ? "message" : "messages"}
              </p>
              <button
                type="button"
                onClick={() => list.forEach((r) => r.unread > 0 && markRead(r.id))}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 text-[11px] font-semibold text-brand-light hover:bg-brand/20"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {list.length === 0 ? (
              <EmptyState
                icon={MessageSquareText}
                title="No requests assigned."
                description="Assignments from your admin will show up here."
              />
            ) : (
              <ul className="space-y-2">
                {list.map((r) => (
                  <li key={r.id}>
                    <ConversationCard request={r} active={selected?.id === r.id} />
                  </li>
                ))}
                {requestsHasMore && (
                  <li className="pt-2">
                    <button
                      onClick={() => void loadMoreRequests()}
                      disabled={requestsLoadingMore}
                      className="w-full rounded-lg border border-border-subtle bg-surface-2 py-2 text-[11px] font-semibold text-text-muted hover:text-white hover:bg-surface-3 transition-colors disabled:opacity-50"
                    >
                      {requestsLoadingMore ? "Loading..." : "Load More"}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        {/* CENTER — conversation */}
        <section
          aria-label="Conversation"
          className={cn("flex min-h-0 flex-col", selected ? "flex" : "hidden lg:flex")}
        >
          {selected ? (
            <Conversation
              request={selected}
              messages={messagesFor(selected.id)}
              onSend={(t) => sendMessage(selected.id, t)}
              onAttach={(f) => attachDocument(selected.id, f)}
              onStatus={(s) => setStatus(selected.id, s)}
              onOpenSheet={() => setSheet(true)}
              onPreview={setPreviewId}
              docCount={documentsFor(selected.id).length}
            />
          ) : search.r ? (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <EmptyState
                icon={MessageSquareText}
                title="Chat unavailable"
                description="This chat has been transferred to another team member or is no longer assigned to you."
              />
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-6">
              <EmptyState
                icon={MessageSquareText}
                title="Select a conversation"
                description="Pick an assigned request from the list to start working."
              />
            </div>
          )}
        </section>

        {/* RIGHT — request info, documents, timeline */}
        <aside
          aria-label="Request information"
          className="hidden min-h-0 flex-col overflow-y-auto border-l border-border-subtle bg-surface-1 xl:flex"
        >
          {selected ? (
            <RequestPanel
              request={selected}
              onPreview={(id) => setPreviewId(id)}
              onStatus={(s) => setStatus(selected.id, s)}
              onSend={sendMessage}
            />
          ) : search.r ? (
            <p className="p-6 text-xs text-text-muted">Chat is no longer assigned to you.</p>
          ) : (
            <p className="p-6 text-xs text-text-muted">Select a request to see its details.</p>
          )}
        </aside>
      </div>

      {sheet && selected && (
        <RequestSheet
          request={selected}
          onClose={() => setSheet(false)}
          onPreview={setPreviewId}
          onStatus={(s) => setStatus(selected.id, s)}
          onSend={sendMessage}
        />
      )}
      {preview && <TeamDocumentPreview document={preview} onClose={() => setPreviewId(null)} />}
    </>
  );
}

function ConversationCard({ request: r, active }: { request: TeamRequest; active: boolean }) {
  const { isUserTyping, markRead } = useTeamStore();
  const typing = isUserTyping(r.id);
  return (
    <div className="relative">
      <Link
        to="/team/work"
        search={(prev: WorkSearch) => ({ ...prev, r: r.id })}
        className={cn(
          "block rounded-xl border p-3 transition-colors",
          active
            ? "border-brand/40 bg-brand/10"
            : "border-white/10 bg-surface-2 hover:border-white/20",
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-3 text-[10px] font-bold text-brand-light">
              {r.userInitials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{r.userName}</p>
              <p className="truncate text-[10px] text-text-muted">{r.id}</p>
            </div>
          </div>
          {/* spacer keeps the card layout stable behind the absolute mark-read control */}
          {r.unread > 0 && <span aria-hidden="true" className="h-5 w-11 shrink-0" />}
        </div>
        <p className="mt-2 truncate text-[11px] text-text-secondary">{r.category}</p>
        {typing ? (
          <p className="mt-1 truncate text-[11px] font-semibold text-brand-light">typing…</p>
        ) : (
          <p className="mt-1 line-clamp-2 text-[11px] text-text-muted">{r.lastMessage}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TeamStatusBadge status={r.status} />
          <PriorityBadge priority={r.priority} />
        </div>
        {r.tags && r.tags.length > 0 && (
          <ChatTagBadges tags={r.tags} className="mt-1.5" />
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-text-muted">
          <span className="truncate">Assigned {r.assignedAt}</span>
          <span className="shrink-0">{r.lastUpdated}</span>
        </div>
      </Link>

      {r.unread > 0 && (
        <button
          type="button"
          onClick={() => markRead(r.id)}
          title="Mark as read"
          aria-label={`Mark ${r.unread} unread ${r.unread === 1 ? "message" : "messages"} from ${r.userName} as read`}
          className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/5"
        >
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
            {r.unread}
          </span>
        </button>
      )}
    </div>
  );
}

const DELIVERY_LABEL: Record<TeamDelivery, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read by user",
  retrying: "Delivery failed — retrying",
  failed: "Not delivered",
};

function DeliveryReceipt({ delivery }: { delivery: TeamDelivery }) {
  const Icon =
    delivery === "failed"
      ? AlertTriangle
      : delivery === "retrying"
        ? RefreshCw
        : delivery === "sending"
          ? Clock3
          : delivery === "sent"
            ? Check
            : CheckCheck;
  return (
    <span className="inline-flex items-center">
      <Icon
        className={cn(
          "h-3 w-3",
          delivery === "failed"
            ? "text-danger"
            : delivery === "retrying"
              ? "animate-spin text-white/80"
              : delivery === "read"
                ? "text-white"
                : delivery === "sending"
                  ? "text-white/50"
                  : "text-white/70",
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{DELIVERY_LABEL[delivery]}</span>
    </span>
  );
}

/** Splits text on a query and wraps matches in <mark>, for in-thread search. */
function Highlighted({ text, query, active }: { text: string; query: string; active: boolean }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className={cn(
              "rounded px-0.5",
              active ? "bg-brand text-white" : "bg-brand/30 text-white",
            )}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const REACTION_CHOICES = ["👍", "🎉", "✅", "👀", "🙏", "❤️"];

/** Reaction chips + picker rendered under a chat bubble. */
function ReadReceipts({
  readBy,
  mine,
}: {
  readBy: NonNullable<TeamMessage["readBy"]>;
  mine: boolean;
}) {
  if (readBy.length === 0) return null;
  const label = readBy.map((p) => `${p.name} at ${p.at}`).join(", ");
  return (
    <span
      className={cn(
        "mt-1 flex flex-wrap items-center gap-1 text-[10px]",
        mine ? "justify-end text-white/80" : "text-text-muted",
      )}
      title={`Read by ${label}`}
    >
      <Eye className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">Read by {label}</span>
      <span aria-hidden="true" className="flex items-center gap-1">
        {readBy.slice(0, 3).map((p) => (
          <span
            key={p.name}
            className={cn(
              "grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold",
              mine ? "bg-white/25 text-white" : "bg-brand/20 text-brand-light",
            )}
          >
            {p.initials}
          </span>
        ))}
        {readBy.length > 3 && <span>+{readBy.length - 3}</span>}
        <span>
          Read by {readBy.length === 1 ? readBy[0]!.name : `${readBy.length} people`} ·{" "}
          {readBy[readBy.length - 1]!.at}
        </span>
      </span>
    </span>
  );
}

function MessageReactions({
  reactions,
  onToggle,
  align,
}: {
  reactions: { emoji: string; by: string[]; mine: boolean }[];
  onToggle: (emoji: string) => void;
  align: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "mt-1 flex flex-wrap items-center gap-1",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.by.length} ${r.by.length === 1 ? "reaction" : "reactions"} — ${r.by.join(", ")}`}
          title={r.by.join(", ")}
          className={cn(
            "inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-[11px] leading-none transition-colors",
            r.mine
              ? "border-brand/60 bg-brand/20 text-white"
              : "border-white/10 bg-surface-2 text-text-secondary hover:bg-white/5",
          )}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span className="font-semibold tabular-nums">{r.by.length}</span>
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Add a reaction"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-surface-2 text-text-muted transition-colors hover:bg-white/5 hover:text-white"
        >
          <SmilePlus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {open && (
          <div
            role="menu"
            aria-label="Choose a reaction"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
            }}
            className={cn(
              "absolute bottom-9 z-20 flex gap-0.5 rounded-full border border-white/10 bg-surface-3 p-1 shadow-xl",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {REACTION_CHOICES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                autoFocus={emoji === REACTION_CHOICES[0]}
                onClick={() => {
                  onToggle(emoji);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                aria-label={`React with ${emoji}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors hover:bg-white/10"
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Conversation({
  request: r,
  messages,
  onSend,
  onAttach,
  onStatus,
  onOpenSheet,
  onPreview,
  docCount,
}: {
  request: TeamRequest;
  messages: TeamMessage[];
  onSend: (text: string) => void;
  onAttach: (file: {
    name: string;
    size: string;
    kind: ReturnType<typeof kindFromFile>;
    previewUrl?: string;
    blob?: File;
  }) => void;
  onStatus: (s: TeamRequest["status"]) => void;
  onOpenSheet: () => void;
  onPreview: (id: string) => void;
  docCount: number;
}) {
  const { session, startCall, acceptCall, hangup, switchCamera } = useWebRTCCall(r.id);
  const {
    getDocument,
    documentsFor,
    isUserTyping,
    notifyTyping,
    markMessageRead,
    markRead,
    toggleReaction,
    editMessage,
    restoreOriginalMessage,
    retryMessage,
    retryFailed,
    failedFor,
    togglePin,
    pinnedFor,
    assignToMe,
    updateTags,
  } = useTeamStore();

  const { member } = useTeamStore();
  const memberId = member?.id || "";

  const failedCount = failedFor(r.id);
  const pinned = pinnedFor(r.id);

  const jumpTo = useCallback((id: string) => {
    const node = bubbleRefs.current[id];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("ring-2", "ring-brand", "rounded-2xl");
    window.setTimeout(() => node.classList.remove("ring-2", "ring-brand", "rounded-2xl"), 1600);
  }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bubbleRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [text, setText] = useState("");
  const typing = isUserTyping(r.id);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Freeze the first unread message when the thread opens so the divider stays put.
  const [dividerId, setDividerId] = useState<string | null>(null);

  const [quickReplies, setQuickReplies] = useState<QuickReplyRow[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const quickRepliesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDividerId(messages.find((m) => m.author === "user" && !m.read)?.id ?? null);
    void listQuickReplies()
      .then(setQuickReplies)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Attachment preview URLs are revoked on unmount so blobs aren't retained.
  const objectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = [];
    },
    [],
  );

  // A message only counts as read once it has actually been on screen.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pendingNodes = useRef(new Set<HTMLLIElement>());

  useEffect(() => {
    // Switching threads must drop the previous thread's nodes: they were kept
    // in the set, so detached bubbles from an old chat were re-observed and
    // could mark the wrong messages as read (and leaked DOM nodes).
    pendingNodes.current.clear();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.messageId;
          if (id) markMessageRead(id);
          io.unobserve(entry.target);
          pendingNodes.current.delete(entry.target as HTMLLIElement);
        }
      },
      { threshold: 0.6 },
    );
    observerRef.current = io;
    pendingNodes.current.forEach((node) => io.observe(node));
    return () => {
      io.disconnect();
      pendingNodes.current.clear();
      observerRef.current = null;
    };
  }, [markMessageRead, r.id]);

  const watchUnread = useCallback((node: HTMLLIElement | null) => {
    if (!node) return;
    pendingNodes.current.add(node);
    observerRef.current?.observe(node);
  }, []);

  const unreadCount = messages.filter((m) => m.author === "user" && !m.read).length;

  // Reaction filter: show only messages carrying a chosen emoji reaction.
  const [reactionFilter, setReactionFilter] = useState<string | null>(null);
  const reactionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages)
      for (const rx of m.reactions ?? []) map.set(rx.emoji, (map.get(rx.emoji) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [messages]);

  useEffect(() => {
    setReactionFilter(null);
  }, [r.id]);

  useEffect(() => {
    if (reactionFilter && !reactionCounts.some(([e]) => e === reactionFilter))
      setReactionFilter(null);
  }, [reactionFilter, reactionCounts]);

  const shownMessages = useMemo(
    () =>
      reactionFilter
        ? messages.filter((m) => (m.reactions ?? []).some((rx) => rx.emoji === reactionFilter))
        : messages,
    [messages, reactionFilter],
  );

  // In-thread keyword search: matches message text and attached document names.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as string[];
    return shownMessages
      .filter((m) => {
        const doc = m.documentId ? getDocument(m.documentId) : undefined;
        return (
          (m.text ?? "").toLowerCase().includes(q) || (doc?.name ?? "").toLowerCase().includes(q)
        );
      })
      .map((m) => m.id);
  }, [shownMessages, query, getDocument]);

  useEffect(() => {
    setMatchIndex(0);
  }, [query]);

  const activeMatchId = matches[matchIndex];

  useEffect(() => {
    if (!activeMatchId) return;
    bubbleRefs.current[activeMatchId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchId]);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (matches.length === 0) return;
      setMatchIndex((i) => (i + dir + matches.length) % matches.length);
    },
    [matches.length],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (searchOpen || reactionFilter) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typing, searchOpen, reactionFilter]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  };

  return (
    <>
      {/* ===== RESPONSIVE HEADER ===== */}
      <header className="relative z-40 border-b border-white/10 bg-surface-1">
        {/* Row 1: Back + User info + critical icon actions */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Link
            to="/team/work"
            search={(prev: WorkSearch) => ({ ...prev, r: undefined })}
            aria-label="Back to assigned chats"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-2 text-[11px] font-bold text-brand-light">
            {r.userInitials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{r.userName}</p>
            <p className="truncate text-[10px] text-text-muted">
              {r.id} • {r.category}
            </p>
          </div>

          {/* In-chat Document Access — xl only */}
          <div className="hidden items-center gap-1 rounded-xl bg-surface-2 p-1 xl:flex">
            {documentsFor(r.id)
              .slice(0, 3)
              .map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onPreview(doc.id)}
                  className="group relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-surface-3 transition-all hover:bg-brand/20 hover:border-brand/40"
                  title={doc.name}
                >
                  <FileText className="h-3.5 w-3.5 text-text-muted group-hover:text-brand" />
                </button>
              ))}
            {docCount > 3 && (
              <button
                onClick={() => onOpenSheet()}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-surface-3 text-[10px] font-bold text-text-muted hover:bg-white/5"
              >
                +{docCount - 3}
              </button>
            )}
          </div>

          {/* Call button — always visible */}
          <button
            type="button"
            onClick={() => startCall("audio")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5 hover:text-brand transition-colors"
            title="Start Audio Call"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => startCall("video")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5 hover:text-brand transition-colors"
            title="Start Video Call"
          >
            <Video className="h-4 w-4" />
          </button>
          {canShareScreen() && (
            <button
              type="button"
              onClick={() => startCall("screen")}
              className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5 hover:text-brand transition-colors"
              title="Share Screen"
            >
              <Monitor className="h-4 w-4" />
            </button>
          )}

          {/* Chat Tags Button on xl+ */}
          <ChatTagButton
            requestId={r.id}
            currentTags={r.tags}
            onTagsUpdated={(newTags) => updateTags(r.id, newTags)}
            className="hidden xl:inline-flex"
          />

          {/* Search — always visible */}
          <button
            type="button"
            onClick={() => {
              setSearchOpen((o) => !o);
              window.setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
            aria-expanded={searchOpen}
            aria-label="Search in this conversation"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-white transition-colors",
              searchOpen
                ? "border-brand/40 bg-brand/10 text-brand-light"
                : "border-white/10 hover:bg-white/5",
            )}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Info / sheet — always visible on non-xl */}
          <button
            type="button"
            onClick={onOpenSheet}
            aria-haspopup="dialog"
            aria-label={`Request details, ${docCount} documents`}
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5 xl:hidden"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
            {docCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                {docCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: Secondary actions — wrap instead of overflow to allow dropdowns */}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-3 py-1.5 xl:hidden">
          <TransferButton request={r} />
          <EscalateButton request={r} />
          <ChatTagButton
            requestId={r.id}
            currentTags={r.tags}
            onTagsUpdated={(newTags) => updateTags(r.id, newTags)}
          />
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markRead(r.id)}
              aria-label={`Mark ${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"} as read`}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 text-[10px] font-semibold text-brand-light hover:bg-brand/20 whitespace-nowrap"
            >
              <CheckCheck className="h-3 w-3" aria-hidden="true" />
              {unreadCount} unread
            </button>
          )}
          <div className="min-w-[7.5rem] flex-1">
            <StatusSelect requestId={r.id} status={r.status} onChange={onStatus} />
          </div>
        </div>

        {/* Row 2 desktop: status in header row (xl+) */}
        <div className="hidden xl:block px-3 py-1.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markRead(r.id)}
              aria-label={`Mark ${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"} as read`}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 text-[10px] font-semibold text-brand-light hover:bg-brand/20 mr-2"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {unreadCount} unread — mark read
            </button>
          )}
        </div>
      </header>

      {searchOpen && (
        <div className="relative border-b border-white/10 bg-surface-1/95 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    step(e.shiftKey ? -1 : 1);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeSearch();
                  }
                }}
                type="search"
                placeholder="Search messages or type '/' for Quick Replies"
                aria-label="Search messages in this conversation"
                className="h-9 w-full rounded-xl border border-white/10 bg-surface-2 pl-8 pr-3 text-xs text-white placeholder:text-text-muted outline-none focus:border-brand/40"
              />
            </div>
            {!query.startsWith("/") && (
              <>
                <span className="shrink-0 text-[10px] text-text-muted" role="status" aria-live="polite">
                  {query.trim()
                    ? matches.length
                      ? `${matchIndex + 1} of ${matches.length}`
                      : "No matches"
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={matches.length === 0}
                  aria-label="Previous match"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5 disabled:opacity-40"
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={matches.length === 0}
                  aria-label="Next match"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5 disabled:opacity-40"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close conversation search"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-text-muted hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Quick Replies list when typing / */}
          {query.startsWith("/") && (
            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-border-subtle bg-surface-2 p-1.5 shadow-2xl space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-brand" /> Quick Custom Replies
              </div>
              {quickReplies
                .filter(
                  (qr) =>
                    qr.title.toLowerCase().includes(query.slice(1).trim().toLowerCase()) ||
                    qr.body.toLowerCase().includes(query.slice(1).trim().toLowerCase()),
                )
                .map((qr) => (
                  <button
                    key={qr.id}
                    type="button"
                    onClick={() => {
                      setText((prev) => (prev ? prev + "\n\n" + qr.body : qr.body));
                      closeSearch();
                      document.getElementById("team-composer")?.focus();
                    }}
                    className="w-full text-left rounded-lg p-2 hover:bg-surface-3 transition-colors group"
                  >
                    <div className="text-xs font-semibold text-white group-hover:text-brand">
                      {qr.title}
                    </div>
                    <div className="text-[11px] text-text-muted truncate mt-0.5">{qr.body}</div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {failedCount > 0 && (
        <div
          role="alert"
          className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-white"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {failedCount} {failedCount === 1 ? "message" : "messages"} failed to send. Nothing was
            lost — retry when you are back online.
          </span>
          <button
            type="button"
            onClick={() => retryFailed(r.id)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-light"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry all
          </button>
        </div>
      )}

      {reactionCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-surface-1/60 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Reactions
          </span>
          {reactionCounts.map(([emoji, count]) => {
            const active = reactionFilter === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => setReactionFilter(active ? null : emoji)}
                aria-pressed={active}
                aria-label={`${active ? "Clear filter for" : "Show only messages reacted with"} ${emoji} (${count})`}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                  active
                    ? "border-brand bg-brand/20 text-brand-light"
                    : "border-white/10 bg-surface-2 text-white hover:border-brand/40 hover:bg-white/5",
                )}
              >
                <span aria-hidden="true">{emoji}</span>
                {count}
              </button>
            );
          })}
          {reactionFilter && (
            <button
              type="button"
              onClick={() => setReactionFilter(null)}
              className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-text-muted hover:bg-white/5 hover:text-white"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Clear
            </button>
          )}
          <span className="w-full text-[10px] text-text-muted" role="status" aria-live="polite">
            {reactionFilter
              ? `Showing ${shownMessages.length} of ${messages.length} messages reacted with ${reactionFilter}`
              : ""}
          </span>
        </div>
      )}

      {pinned.length > 0 && (
        <section
          aria-label={`${pinned.length} pinned ${pinned.length === 1 ? "message" : "messages"}`}
          className="border-b border-white/10 bg-surface-1/80 px-3 py-2"
        >
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-light">
            <Pin className="h-3 w-3" aria-hidden="true" />
            Pinned ({pinned.length})
          </p>
          <ul className="flex max-h-28 flex-col gap-1.5 overflow-y-auto">
            {pinned.map((pm) => {
              const pdoc = pm.documentId ? getDocument(pm.documentId) : undefined;
              return (
                <li key={`pin-${pm.id}`} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => jumpTo(pm.id)}
                    className="min-h-9 min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-left text-[11px] text-white hover:border-brand/40 hover:bg-white/5"
                    aria-label={`Jump to pinned message from ${pm.authorName}`}
                  >
                    <span className="mr-1.5 font-semibold text-text-muted">{pm.authorName}:</span>
                    {pm.text || pdoc?.name || "Attachment"}
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePin(pm.id)}
                    aria-label={`Unpin message from ${pm.authorName}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-text-muted hover:bg-white/5 hover:text-white"
                  >
                    <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="mx-auto flex max-w-2xl flex-col gap-3">
          {shownMessages.map((m) => {
            if (m.callLog) {
              return (
                <li key={m.id} className="list-none w-full">
                  <CallEventBubble
                    callLog={m.callLog as any}
                    time={m.time}
                    currentUserId={member?.id}
                    onCallBack={(type) => startCall(type)}
                  />
                </li>
              );
            }

            const mine = member && m.senderId ? m.senderId === member.id : m.author === "team";
            const doc = m.documentId ? getDocument(m.documentId) : undefined;
            const unread = !mine && !m.read;
            return (
              <li
                key={m.id}
                ref={(node) => {
                  bubbleRefs.current[m.id] = node;
                  if (unread) watchUnread(node);
                }}
                data-message-id={m.id}
                className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              >
                {dividerId === m.id && (
                  <span className="mb-1 flex w-full items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-brand-light">
                    <span aria-hidden="true" className="h-px flex-1 bg-brand/40" />
                    New messages
                    <span aria-hidden="true" className="h-px flex-1 bg-brand/40" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed sm:max-w-[70%]",
                    mine
                      ? "bg-brand text-white"
                      : "bg-surface-2 border border-border-subtle text-white",

                    reactionFilter && "ring-1 ring-brand/60",
                    activeMatchId === m.id && "ring-2 ring-brand ring-offset-2 ring-offset-bg",
                  )}
                >
                  {!mine && (
                    <p className="mb-1 text-[10px] font-semibold text-text-muted">{m.authorName}</p>
                  )}
                  {editingId === m.id ? (
                    <div className="flex flex-col gap-2">
                      <label className="sr-only" htmlFor={`edit-${m.id}`}>
                        Edit message
                      </label>
                      <textarea
                        id={`edit-${m.id}`}
                        autoFocus
                        rows={2}
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingId(null);
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            editMessage(m.id, editDraft);
                            setEditingId(null);
                          }
                        }}
                        className="w-full resize-none rounded-lg border border-white/25 bg-black/25 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/50"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            editMessage(m.id, editDraft);
                            setEditingId(null);
                          }}
                          className="inline-flex min-h-7 items-center rounded-full bg-white/20 px-2.5 text-[10px] font-semibold text-white hover:bg-white/30"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex min-h-7 items-center rounded-full px-2.5 text-[10px] font-semibold text-white/80 hover:bg-white/15"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    m.text && (
                      <p className="whitespace-pre-wrap break-words">
                        <Highlighted text={m.text} query={query} active={activeMatchId === m.id} />
                      </p>
                    )
                  )}
                  {doc && (
                    <MessageAttachment
                      document={doc}
                      mine={mine}
                      onPreview={onPreview}
                      onDelete={(id, storagePath) => void deleteDocument(id, storagePath)}
                    />
                  )}

                  {editingId !== m.id && (
                    <div className={cn("mt-1.5 flex", mine ? "justify-end" : "justify-start")}>
                      <button
                        type="button"
                        onClick={() => togglePin(m.id)}
                        aria-pressed={!!m.pinned}
                        aria-label={m.pinned ? "Unpin this message" : "Pin this message"}
                        className={cn(
                          "inline-flex min-h-7 items-center gap-1 rounded-full px-2 text-[10px] font-semibold",
                          mine
                            ? "text-white/80 hover:bg-white/15"
                            : "text-text-muted hover:bg-white/10 hover:text-white",
                          m.pinned && "text-brand-light",
                        )}
                      >
                        {m.pinned ? (
                          <PinOff className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Pin className="h-3 w-3" aria-hidden="true" />
                        )}
                        {m.pinned ? `Pinned${m.pinnedAt ? ` · ${m.pinnedAt}` : ""}` : "Pin"}
                      </button>
                    </div>
                  )}

                  {mine && m.text && editingId !== m.id && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-white/80">
                      <button
                        type="button"
                        onClick={() => {
                          setEditDraft(m.text ?? "");
                          setEditingId(m.id);
                        }}
                        className="inline-flex min-h-7 items-center gap-1 rounded-full px-2 font-semibold hover:bg-white/15"
                        aria-label="Edit this message"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        Edit
                      </button>
                      {m.edited && (
                        <>
                          <button
                            type="button"
                            onClick={() => setHistoryId(historyId === m.id ? null : m.id)}
                            aria-expanded={historyId === m.id}
                            className="inline-flex min-h-7 items-center gap-1 rounded-full bg-black/20 px-2 font-semibold hover:bg-black/30"
                          >
                            <History className="h-3 w-3" aria-hidden="true" />
                            Edited{m.editedAt ? ` · ${m.editedAt}` : ""} ({m.history?.length ?? 0}{" "}
                            {(m.history?.length ?? 0) === 1 ? "version" : "versions"})
                          </button>
                          <button
                            type="button"
                            onClick={() => restoreOriginalMessage(m.id)}
                            className="inline-flex min-h-7 items-center gap-1 rounded-full px-2 font-semibold hover:bg-white/15"
                          >
                            <Undo2 className="h-3 w-3" aria-hidden="true" />
                            Restore original
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {historyId === m.id && m.history?.length ? (
                    <ol className="mt-2 space-y-1.5 rounded-lg bg-black/25 p-2 text-[10px]">
                      {m.history.map((v, i) => (
                        <li key={`${m.id}-v${i}`} className="flex flex-col gap-0.5">
                          <span className="font-semibold text-white/70">
                            {i === 0 ? "Original" : `Version ${i + 1}`} · {v.at}
                          </span>
                          <span className="whitespace-pre-wrap break-words text-white/90">
                            {v.text}
                          </span>
                        </li>
                      ))}
                      <li className="flex flex-col gap-0.5 border-t border-white/15 pt-1.5">
                        <span className="font-semibold text-white/70">
                          Current · {m.editedAt ?? m.time}
                        </span>
                        <span className="whitespace-pre-wrap break-words text-white/90">
                          {m.text}
                        </span>
                      </li>
                    </ol>
                  ) : null}

                  {mine && (m.delivery === "failed" || m.delivery === "retrying") && (
                    <span
                      role="status"
                      aria-live="polite"
                      className={cn(
                        "mt-2 flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-[10px]",
                        m.delivery === "failed"
                          ? "bg-black/25 text-white"
                          : "bg-black/15 text-white/80",
                      )}
                    >
                      <span>
                        {m.deliveryError ??
                          (m.delivery === "failed" ? "Message not delivered." : "Retrying…")}
                        {m.attempts ? ` (attempt ${m.attempts})` : ""}
                      </span>
                      {m.delivery === "failed" && (
                        <button
                          type="button"
                          onClick={() => retryMessage(m.id)}
                          className="inline-flex min-h-7 items-center gap-1 rounded-full bg-white/15 px-2 font-semibold text-white transition-colors hover:bg-white/25"
                          aria-label="Retry sending this message"
                        >
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          Retry
                        </button>
                      )}
                    </span>
                  )}

                  <span
                    className={cn(
                      "mt-1 flex items-center justify-end gap-1 text-[10px]",
                      mine ? "text-white/80" : "text-text-muted",
                    )}
                  >
                    {m.time}
                    {mine && (
                      <DeliveryReceipt delivery={m.delivery ?? (m.read ? "read" : "sent")} />
                    )}
                  </span>

                  <ReadReceipts readBy={m.readBy ?? []} mine={mine} />
                </div>

                <MessageReactions
                  reactions={m.reactions ?? []}
                  onToggle={(emoji) => toggleReaction(m.id, emoji)}
                  align={mine ? "end" : "start"}
                />
              </li>
            );
          })}
        </ul>
        {typing && (
          <div
            className="mx-auto mt-3 flex max-w-2xl items-center gap-2"
            role="status"
            aria-live="polite"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-2 text-[10px] font-bold text-brand-light">
              {r.userInitials}
            </span>
            <span className="flex items-center gap-1 rounded-2xl border border-white/10 bg-surface-2 px-3 py-2.5">
              <span className="sr-only">{r.userName} is typing</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-light"
                  style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }}
                />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-0 border-t border-white/10 bg-bg/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              files.forEach((file) => {
                const isImage = file.type.startsWith("image/");
                let previewUrl: string | undefined;
                if (isImage) {
                  previewUrl = URL.createObjectURL(file);
                  objectUrls.current.push(previewUrl);
                }
                onAttach({
                  name: file.name,
                  size: formatBytes(file.size),
                  kind: kindFromFile(file),
                  previewUrl,
                  blob: file,
                });
              });
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach files or documents"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="relative" ref={quickRepliesRef}>
            <button
              type="button"
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              aria-label="Insert quick reply"
              className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 transition-colors",
                showQuickReplies ? "bg-white/10 text-white" : "text-white hover:bg-white/5",
              )}
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
            </button>
            {showQuickReplies && quickReplies.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-[min(16rem,calc(100vw-3rem))] max-h-64 overflow-y-auto rounded-xl border border-border-subtle bg-surface-1 p-2 shadow-xl z-50">
                <div className="mb-2 px-2 pb-2 pt-1 text-[11px] font-semibold text-text-muted border-b border-border-subtle">
                  Quick Replies
                </div>
                {quickReplies.map((qr) => (
                  <button
                    key={qr.id}
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2 text-sm text-white hover:bg-surface-2 transition-colors mb-1"
                    onClick={() => {
                      setText((prev) => (prev ? prev + "\n\n" + qr.body : qr.body));
                      setShowQuickReplies(false);
                      document.getElementById("team-composer")?.focus();
                    }}
                  >
                    <div className="font-medium truncate">{qr.title}</div>
                    <div className="text-[11px] text-text-muted truncate mt-0.5">{qr.body}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <label htmlFor="team-composer" className="sr-only">
            Write a message
          </label>
          <textarea
            id="team-composer"
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              notifyTyping(r.id);
              if (r.assigneeId === "Awaiting assignment") {
                // Auto-assign on first typing/message
                void assignToMe(r.id);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder="Write a reply…"
            className="max-h-32 min-h-11 w-full resize-none rounded-xl border border-border-subtle bg-surface-2 px-3 py-3 text-[11px] text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
          />
          <button
            type="submit"
            aria-label="Send message"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white active:scale-95"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </form>
      <CallOverlay
        session={session}
        onAccept={acceptCall}
        onHangup={hangup}
        onSwitchCamera={switchCamera}
      />
    </>
  );
}

function RequestPanel({
  request: r,
  onPreview,
  onStatus,
  onSend,
}: {
  request: TeamRequest;
  onPreview: (id: string) => void;
  onStatus: (s: TeamRequest["status"]) => void;
  onSend: (requestId: string, text: string) => void;
}) {
  const { documentsFor } = useTeamStore();
  const docs = documentsFor(r.id);

  const rows = [
    { label: "User Name", value: r.userName },
    { label: "Request ID", value: r.id },
    { label: "Created On", value: r.createdOn },
    { label: "Current Status", value: null as string | null },
    { label: "Priority", value: null as string | null },
    { label: "Category", value: r.category },
    { label: "Documents Uploaded", value: String(docs.length) },
    { label: "Last Updated", value: r.lastUpdated },
  ];

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-white">Request Information</h2>
      <dl className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <dt className="text-[11px] text-text-muted">{row.label}</dt>
            <dd className="min-w-0 text-right text-[11px] font-semibold text-white">
              {row.label === "Current Status" ? (
                <TeamStatusBadge status={r.status} />
              ) : row.label === "Priority" ? (
                <PriorityBadge priority={r.priority} />
              ) : row.label === "Category" ? (
                <CategorySelect requestId={r.id} category={r.category} className="w-40" />
              ) : (
                <span className="truncate">{row.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        <StatusSelect requestId={r.id} status={r.status} onChange={onStatus} />
        {r.status !== "completed" && (
          <Button
            onClick={() => onStatus("completed")}
            className="w-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 h-9 text-[11px] font-bold"
          >
            Mark as Completed
          </Button>
        )}
      </div>

      <h3 className="mt-6 text-sm font-semibold text-white">Documents</h3>
      {docs.length === 0 ? (
        <p className="mt-2 text-[11px] text-text-muted">No documents uploaded.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {docs.map((d) => (
            <TeamDocumentCard
              key={d.id}
              document={d}
              requestTitle={r.title}
              onPreview={() => onPreview(d.id)}
              onDelete={() => void deleteDocument(d.id, d.storagePath)}
            />
          ))}
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold text-white">Timeline</h3>
      <ol className="mt-3 space-y-3 border-l border-white/10 pl-4">
        {r.timeline.map((t, i) => (
          <li key={`${t.label}-${i}`} className="relative">
            <span
              className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-brand"
              aria-hidden="true"
            />
            <p className="text-[11px] font-semibold text-white">{t.label}</p>
            <p className="text-[10px] text-text-muted">{t.time}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RequestSheet({
  request,
  onClose,
  onPreview,
  onStatus,
  onSend,
}: {
  request: TeamRequest;
  onClose: () => void;
  onPreview: (id: string) => void;
  onStatus: (s: TeamRequest["status"]) => void;
  onSend: (requestId: string, text: string) => void;
}) {
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm xl:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Request details"
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl border border-white/10 bg-surface-1 duration-200 animate-in slide-in-from-bottom-4 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Request Details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close request details"

            className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RequestPanel
            request={request}
            onPreview={onPreview}
            onStatus={onStatus}
            onSend={onSend}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
