import { createFileRoute } from "@tanstack/react-router";
import { canShareScreen } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Monitor,
  Paperclip,
  Phone,
  Video,
  Send,
  Share2,
  AlertTriangle,
  Eye,
  Download,
} from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Button, Panel, Pill, SearchBox, formatDate, inputClass } from "@/components/admin/AdminUI";
import * as messagesApi from "@/lib/api/messages";
import { openDocument } from "@/lib/doc-access";
import * as requestsApi from "@/lib/api/requests";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, type DbRequestStatus } from "@/lib/api/types";
import { useWebRTCCall } from "@/hooks/use-webrtc-call";
import { CallOverlay } from "@/components/chat/CallOverlay";
import { MessageAttachment } from "@/components/team/MessageAttachment";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_shell/chats")({
  component: AdminChats,
  validateSearch: (search: Record<string, unknown>) => ({
    request: typeof search["request"] === "string" ? (search["request"] as string) : undefined,
  }),
});

const STATUSES: DbRequestStatus[] = [
  "pending",
  "assigned",
  "waiting_documents",
  "under_review",
  "in_progress",
  "completed",
  "cancelled",
];

function AdminChats() {
  const { request: initial } = Route.useSearch();
  const { activity, profileOf, refresh, requestsPage, requestsTotal, fetchRequestsPage } =
    useAdmin();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | undefined>(initial);
  const [messages, setMessages] = useState<messagesApi.MessageWithDoc[]>([]);
  const [chatType, setChatType] = useState<"monitor" | "team">("monitor");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { session, startCall, acceptCall, hangup } = useWebRTCCall(activeId);
  const pageSize = 50;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  // Fetch page
  useEffect(() => {
    void fetchRequestsPage(page, {
      search: debouncedQ || undefined,
      limit: pageSize,
    });
  }, [page, debouncedQ, fetchRequestsPage]);

  const threads = requestsPage;
  const totalPages = Math.max(1, Math.ceil(requestsTotal / pageSize));

  const [fetchedActive, setFetchedActive] = useState<any>(null);

  useEffect(() => {
    if (activeId && !requestsPage.find((r) => r.id === activeId)) {
      void requestsApi
        .getRequest(activeId)
        .then((r) => {
          if (r) setFetchedActive(r);
        })
        .catch(console.error);
    }
  }, [activeId, requestsPage]);

  const active =
    requestsPage.find((r) => r.id === activeId) ??
    (fetchedActive?.id === activeId ? fetchedActive : null) ??
    threads[0] ??
    null;

  useEffect(() => {
    if (!active) {
      setRoom(null);
      return;
    }
    void requestsApi.getChatRoom(active.id).then(setRoom).catch(console.error);
  }, [active?.id]);

  useEffect(() => {
    if (!room) {
      setMessages([]);
      return;
    }
    let alive = true;
    void messagesApi.listMessages(room.id, { limit: 100 }).then((rows) => {
      if (alive) setMessages(rows);
    });

    const channel = supabase
      .channel(`admin-room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `chat_room_id=eq.${room.id}` },
        () => {
          void messagesApi.listMessages(room.id, { limit: 100 }).then((rows) => {
            if (alive) setMessages(rows);
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [room]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || !room || !active) return;
    setBusy(true);
    try {
      await messagesApi.sendMessage({
        chatRoomId: room.id,
        requestId: active.id,
        body: draft.trim(),
        senderRole: "admin",
      });
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    // Document uploads by admin disabled for privacy
    alert("Administrative staff cannot upload documents to maintain privacy standards.");
  };

  const openDoc = async (path: string) => {
    // Direct document viewing by admin disabled for privacy
    alert("Viewing user documents is restricted to maintain privacy.");
  };

  return (
    <div className="fixed inset-0 lg:left-60 xl:left-64 top-14 z-10 bg-bg overflow-hidden">
      <div className="grid h-full gap-4 p-4 xl:grid-cols-[320px_1fr]">
        <Panel title="Conversations" className="h-full overflow-y-auto">
          <div className="mb-3">
            <SearchBox
              value={q}
              onChange={setQ}
              label="Search chats"
              placeholder="User, request…"
            />
          </div>
          <ul className="space-y-2">
            {threads.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
                    active?.id === r.id
                      ? "border-brand bg-brand/10 shadow-sm shadow-brand/10"
                      : "border-border-subtle bg-bg hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="truncate text-xs font-bold text-white group-hover:text-brand transition-colors">
                        {profileOf(r.user_id)?.full_name ?? "User"}
                      </h3>
                      {r.is_escalated && (
                        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                      )}
                    </div>
                    <time className="shrink-0 text-[10px] font-medium text-text-muted pl-2">
                      {formatDate(r.last_activity_at)}
                    </time>
                  </div>
                  <p className="truncate text-[11px] text-text-secondary">
                    {r.last_message ?? r.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-text-muted font-mono">{r.reference}</span>
                    <Pill tone={r.status === "completed" ? "ok" : "brand"}>
                      {STATUS_LABEL[r.status]}
                    </Pill>
                  </div>
                </button>
              </li>
            ))}
            {!threads.length && (
              <li className="py-6 text-center text-xs text-text-muted">No conversations.</li>
            )}
          </ul>

          <div className="flex items-center justify-between p-3 border-t border-border-subtle/50 text-xs mt-auto shrink-0">
            <span className="text-text-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Panel>

        <div className="flex flex-col h-full gap-4 overflow-hidden">
          <Panel
            title={active ? `${active.reference} — ${active.title}` : "Select a conversation"}
            className="flex-1 flex flex-col overflow-hidden"
            action={
              active && (
                <div className="flex items-center gap-2">
                  <div className="flex bg-surface-2 p-0.5 rounded-lg border border-border-subtle mr-2">
                    <button
                      onClick={() => setChatType("monitor")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                        chatType === "monitor"
                          ? "bg-brand text-white shadow-sm"
                          : "text-text-muted hover:text-white"
                      }`}
                    >
                      Monitoring
                    </button>
                    <button
                      onClick={() => setChatType("team")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                        chatType === "team"
                          ? "bg-brand text-white shadow-sm"
                          : "text-text-muted hover:text-white"
                      }`}
                    >
                      Team Private
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => startCall("audio")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-text-muted hover:border-brand/40 hover:text-brand transition-colors"
                      title="Start Audio Call"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => startCall("video")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-text-muted hover:border-brand/40 hover:text-brand transition-colors"
                      title="Start Video Call"
                    >
                      <Video className="h-3.5 w-3.5" />
                    </button>
                    {canShareScreen() && (
                      <button
                        onClick={() => startCall("screen")}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-text-muted hover:border-brand/40 hover:text-brand transition-colors"
                        title="Share Screen"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            }
          >
            {active ? (
              <div className="flex flex-1 gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex-1 space-y-4 overflow-y-auto pr-2 py-2">
                    {chatType === "team" ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                        <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                          <Send className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">Private Team Channel</h4>
                          <p className="text-[10px] text-text-muted max-w-[200px]">
                            Messages here are only visible to Admin and the assigned Team Member.
                          </p>
                        </div>
                        <Pill tone="brand">Feature coming soon</Pill>
                      </div>
                    ) : (
                      <>
                        {messages.map((m) => {
                          const mine = m.sender_role === "admin";
                          return (
                            <div
                              key={m.id}
                              className={`flex ${mine ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl border px-4 py-3 text-xs shadow-sm ${
                                  m.is_system
                                    ? "border-border-subtle bg-surface-1 text-text-muted mx-auto text-center"
                                    : mine
                                      ? "border-brand/40 bg-brand/15 text-white"
                                      : "border-border-subtle bg-bg text-text-secondary"
                                }`}
                              >
                                {!m.is_system && (
                                  <div className="flex items-center justify-between gap-4 mb-1 border-b border-white/5 pb-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-brand">
                                      {m.sender_role}
                                    </span>
                                    <span className="text-[8px] text-text-muted">
                                      {formatDate(m.created_at)}
                                    </span>
                                  </div>
                                )}
                                {m.body && (
                                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                                    {m.body}
                                  </p>
                                )}
                                {m.attachment && (
                                  <MessageAttachment
                                    document={{
                                      id: m.attachment.id,
                                      requestId: m.attachment.request_id || "",
                                      name: m.attachment.file_name,
                                      kind: m.attachment.kind as any,
                                      size: Math.round((m.attachment.size_bytes || 0) / 1024) + " KB",
                                      uploadedAt: new Date(m.attachment.created_at).toISOString(),
                                      uploadedBy: m.attachment.uploader_role === "user" ? "User" : "Team",
                                      storagePath: m.attachment.storage_path,
                                    }}
                                    mine={m.is_system ? false : m.sender_role === "admin"}
                                    onPreview={() =>
                                      void openDocument(
                                        {
                                          name: m.attachment!.file_name,
                                          storagePath: m.attachment!.storage_path,
                                        },
                                        false,
                                      )
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {!messages.length && (
                          <div className="flex flex-col items-center justify-center h-full text-text-muted">
                            <p className="text-xs">No messages in this thread yet.</p>
                          </div>
                        )}
                      </>
                    )}
                    <div ref={endRef} />
                  </div>

                  <div className="mt-auto border-t border-border-subtle pt-4 bg-surface-1/50 -mx-4 px-4 pb-2">
                    <div className="flex items-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => alert("Restricted: Admin cannot upload documents.")}
                        disabled={busy}
                        className="h-10 w-10 p-0 rounded-xl"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <textarea
                        rows={1}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        placeholder="Type a message as admin..."
                        className={`${inputClass} min-h-10 max-h-32 resize-none py-2.5 flex-1`}
                      />
                      <Button
                        onClick={() => void send()}
                        disabled={busy || !draft.trim()}
                        className="h-10 w-10 p-0 rounded-xl"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="w-72 border-l border-border-subtle pl-4 hidden xl:block overflow-y-auto">
                  <div className="space-y-6">
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-3">
                        Request Info
                      </h4>
                      <div className="space-y-2.5">
                        <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle">
                          <p className="text-[10px] text-text-muted uppercase font-bold mb-1">
                            Status
                          </p>
                          <select
                            className={`${inputClass} h-8 text-[11px]`}
                            value={active.status}
                            onChange={(e) =>
                              void requestsApi
                                .updateRequestStatus(active.id, e.target.value as DbRequestStatus)
                                .then(() => refresh())
                            }
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle space-y-2">
                          <div>
                            <p className="text-[10px] text-text-muted uppercase font-bold">User</p>
                            <p className="text-xs text-white font-medium">
                              {profileOf(active.user_id)?.full_name ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-text-muted uppercase font-bold">
                              Team Member
                            </p>
                            <p className="text-xs text-white font-medium">
                              {profileOf(active.assigned_team_id)?.full_name ?? "Unassigned"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-3">
                        Timeline
                      </h4>
                      <div className="space-y-3 relative before:absolute before:left-1 before:top-2 before:bottom-0 before:w-px before:bg-border-subtle">
                        {activity
                          .filter((a) => a.request_id === active.id)
                          .slice(0, 6)
                          .map((a) => (
                            <div key={a.id} className="pl-4 relative">
                              <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-brand ring-4 ring-bg" />
                              <p className="text-[10px] text-white font-medium leading-tight">
                                {a.label ?? a.action}
                              </p>
                              <p className="text-[8px] text-text-muted uppercase mt-0.5">
                                {formatDate(a.created_at)}
                              </p>
                            </div>
                          ))}
                      </div>
                    </section>

                    <div className="p-3 rounded-xl bg-brand/5 border border-brand/20">
                      <p className="text-[9px] font-bold text-brand uppercase mb-1">
                        Privacy Restricted
                      </p>
                      <p className="text-[9px] text-text-muted leading-relaxed italic">
                        Documents and personal files are hidden from administrative view to comply
                        with privacy standards.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="h-16 w-16 rounded-3xl bg-surface-2 flex items-center justify-center text-text-muted mb-4 border border-white/5">
                  <Send className="h-8 w-8 opacity-20" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">Select a Conversation</h3>
                <p className="text-xs text-text-muted max-w-[240px]">
                  Pick a chat from the left panel to monitor the conversation and view request
                  details.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>
      <CallOverlay session={session} onAccept={acceptCall} onHangup={hangup} />
    </div>
  );
}
