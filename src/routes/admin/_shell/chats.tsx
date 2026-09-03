import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { canShareScreen, cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Monitor,
  Paperclip,
  Phone,
  Video,
  Send,
  Users,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Button, Panel, Pill, SearchBox, formatDate, inputClass } from "@/components/admin/AdminUI";
import * as messagesApi from "@/lib/api/messages";
import { subscribeToRoom } from "@/lib/api/realtime";
import { openDocument } from "@/lib/doc-access";
import * as requestsApi from "@/lib/api/requests";
import * as notificationsApi from "@/lib/api/notifications";
import { getOrCreateAdminTeamChat } from "@/lib/api/admin-team-chat";
import { STATUS_LABEL, type DbRequestStatus } from "@/lib/api/types";
import { useGlobalCall } from "@/lib/call-store";
import { CallEventBubble } from "@/components/chat/CallEventBubble";
import { MessageAttachment } from "@/components/team/MessageAttachment";
import { ChatTagButton, ChatTagBadges } from "@/components/team/ChatTagModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_shell/chats")({
  component: AdminChats,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    request?: string;
    teamMember?: string;
    type?: "monitor" | "team";
  } => ({
    request: typeof search["request"] === "string" ? (search["request"] as string) : undefined,
    teamMember:
      typeof search["teamMember"] === "string" ? (search["teamMember"] as string) : undefined,
    type:
      search["type"] === "team" || search["type"] === "monitor"
        ? (search["type"] as "monitor" | "team")
        : undefined,
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
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const initialRequest = searchParams.request;
  const initialTeamMember = searchParams.teamMember;
  const initialType = searchParams.type || (initialTeamMember ? "team" : "monitor");

  const { activity, profileOf, refresh, requestsPage, requestsTotal, fetchRequestsPage, team, profiles } =
    useAdmin();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | undefined>(initialRequest);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string | undefined>(
    initialTeamMember,
  );
  const [messages, setMessages] = useState<messagesApi.MessageWithDoc[]>([]);
  const [chatType, setChatType] = useState<"monitor" | "team">(initialType);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [fetchedActive, setFetchedActive] = useState<any>(null);

  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // Sync search parameters bidirectionally (handles history back/forward)
  useEffect(() => {
    setActiveId(searchParams.request);
    setSelectedTeamMemberId(searchParams.teamMember);
    if (searchParams.type) {
      setChatType(searchParams.type);
    }
  }, [searchParams.request, searchParams.teamMember, searchParams.type]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentAdminId(data.user?.id ?? null));
    void notificationsApi.listQuickReplies().then(setQuickReplies).catch(() => {});
  }, []);

  const customerRequests = useMemo(() => {
    let list = requestsPage.filter(
      (r) =>
        r.category !== "Team Direct Report" &&
        !r.reference?.startsWith("ADM-TM") &&
        !r.id.startsWith("ADM-TM"),
    );
    if (
      fetchedActive &&
      fetchedActive.category !== "Team Direct Report" &&
      !fetchedActive.reference?.startsWith("ADM-TM") &&
      !list.some((r) => r.id === fetchedActive.id)
    ) {
      list = [fetchedActive, ...list];
    }
    return list;
  }, [requestsPage, fetchedActive]);

  const active =
    (activeId
      ? (chatType === "monitor"
          ? customerRequests.find((r) => r.id === activeId)
          : requestsPage.find((r) => r.id === activeId)) ??
        (fetchedActive?.id === activeId ? fetchedActive : null)
      : null) ??
    (typeof window !== "undefined" && window.innerWidth >= 1280 && chatType === "monitor"
      ? customerRequests[0] ?? null
      : null);

  const { session, startCall, acceptCall, hangup, setActiveRoomId } = useGlobalCall();
  const pageSize = 50;

  useEffect(() => {
    if (active?.id) {
      setActiveRoomId(active.id);
    }
  }, [active?.id, setActiveRoomId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  // Fetch page for monitor
  useEffect(() => {
    if (chatType === "monitor") {
      void fetchRequestsPage(page, {
        search: debouncedQ || undefined,
        limit: pageSize,
      });
    }
  }, [page, debouncedQ, fetchRequestsPage, chatType]);

  const threads = customerRequests;
  const totalPages = Math.max(1, Math.ceil(requestsTotal / pageSize));

  // Filtered team members for Team Chat
  const teamList = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    return team
      .map((t) => ({ member: t, profile: profiles.find((p) => p.id === t.id) }))
      .filter(({ member, profile }) => {
        if (!term) return true;
        return (
          (profile?.full_name ?? "").toLowerCase().includes(term) ||
          (profile?.email ?? "").toLowerCase().includes(term) ||
          member.job_title.toLowerCase().includes(term) ||
          member.team_code.toLowerCase().includes(term)
        );
      });
  }, [team, profiles, debouncedQ]);

  // If initial request param or activeId changes in monitor mode
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

  // When request/user is selected in Monitor mode
  const handleSelectRequest = (id: string) => {
    setActiveId(id);
    void navigate({
      to: "/admin/chats",
      search: (prev) => ({ ...prev, request: id, type: "monitor", teamMember: undefined }),
      replace: false,
    });
  };

  // When team member is selected in Team Chat mode
  const handleSelectTeamMember = async (tmId: string, name?: string) => {
    setSelectedTeamMemberId(tmId);
    void navigate({
      to: "/admin/chats",
      search: (prev) => ({ ...prev, teamMember: tmId, type: "team", request: undefined }),
      replace: false,
    });
    setBusy(true);
    try {
      const { request: req, room: r } = await getOrCreateAdminTeamChat(tmId, name);
      setFetchedActive(req);
      setActiveId(req.id);
      setRoom(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open team chat");
    } finally {
      setBusy(false);
    }
  };

  const handleBackToList = () => {
    setActiveId(undefined);
    setSelectedTeamMemberId(undefined);
    setFetchedActive(null);
    setRoom(null);
    void navigate({
      to: "/admin/chats",
      search: (prev) => ({
        ...prev,
        request: undefined,
        teamMember: undefined,
      }),
      replace: false,
    });
  };

  useEffect(() => {
    if (chatType === "team" && selectedTeamMemberId && !room) {
      const targetProfile = profiles.find((p) => p.id === selectedTeamMemberId);
      void handleSelectTeamMember(selectedTeamMemberId, targetProfile?.full_name);
    }
  }, [chatType, selectedTeamMemberId, profiles, room]);

  // Load chat room for monitor mode (create if missing so admin can always view & chat)
  useEffect(() => {
    if (chatType === "monitor") {
      if (!active) {
        setRoom(null);
        return;
      }
      void requestsApi.getOrCreateChatRoom(active.id).then(setRoom).catch(console.error);
    }
  }, [active?.id, chatType]);

  // Real-time message subscription
  useEffect(() => {
    if (!room) {
      setMessages([]);
      return;
    }
    let alive = true;
    void messagesApi.listMessages(room.id, { limit: 100 }).then((rows) => {
      if (alive) setMessages(rows);
    });

    const unsubscribe = subscribeToRoom(room.id, {
      onMessage: () => {
        void messagesApi.listMessages(room.id, { limit: 100 }).then((rows) => {
          if (alive) setMessages(rows);
        });
      },
      onMessageUpdate: () => {
        void messagesApi.listMessages(room.id, { limit: 100 }).then((rows) => {
          if (alive) setMessages(rows);
        });
      },
    });

    return () => {
      alive = false;
      unsubscribe();
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

  const currentTeamMemberProfile = selectedTeamMemberId
    ? profiles.find((p) => p.id === selectedTeamMemberId)
    : null;
  const isMobileDetailOpen = Boolean(
    chatType === "monitor" ? Boolean(activeId) : Boolean(selectedTeamMemberId),
  );

  return (
    <div className="fixed inset-0 lg:left-60 xl:left-64 top-[calc(3.5rem+env(safe-area-inset-top))] z-10 bg-bg overflow-hidden">
      <div className="grid h-full gap-4 p-4 xl:grid-cols-[320px_1fr]">
        <Panel
          title={chatType === "monitor" ? "Customer Chats" : "Team Direct Chats"}
          className={cn("h-full overflow-y-auto", isMobileDetailOpen ? "hidden xl:block" : "block")}
          action={
            <div className="flex bg-surface-2 p-0.5 rounded-lg border border-border-subtle">
              <button
                onClick={() => {
                  setChatType("monitor");
                  setSelectedTeamMemberId(undefined);
                  void navigate({
                    to: "/admin/chats",
                    search: (prev) => ({ ...prev, type: "monitor", teamMember: undefined }),
                    replace: true,
                  });
                }}
                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                  chatType === "monitor"
                    ? "bg-brand text-white shadow-sm"
                    : "text-text-muted hover:text-white"
                }`}
              >
                Requests
              </button>
              <button
                onClick={() => {
                  setChatType("team");
                  setActiveId(undefined);
                  void navigate({
                    to: "/admin/chats",
                    search: (prev) => ({ ...prev, type: "team", request: undefined }),
                    replace: true,
                  });
                }}
                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                  chatType === "team"
                    ? "bg-brand text-white shadow-sm"
                    : "text-text-muted hover:text-white"
                }`}
              >
                Team ({team.length})
              </button>
            </div>
          }
        >
          <div className="mb-3">
            <SearchBox
              value={q}
              onChange={setQ}
              label="Search chats"
              placeholder={chatType === "monitor" ? "User, request…" : "Team member, code…"}
            />
          </div>

          {chatType === "monitor" ? (
            <>
              <ul className="space-y-2">
                {threads.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectRequest(r.id)}
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
                      {r.tags && r.tags.length > 0 && (
                        <ChatTagBadges tags={r.tags} className="mt-1" />
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-text-muted font-mono">{r.reference}</span>
                        <Pill tone={r.status === "completed" ? "ok" : "brand"}>
                          {STATUS_LABEL[r.status]}
                        </Pill>
                      </div>
                      <div className="mt-1 text-[10px] text-text-muted truncate">
                        Agent: <span className="text-text-secondary">{profileOf(r.assigned_team_id)?.full_name ?? "Unassigned"}</span>
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
            </>
          ) : (
            <ul className="space-y-2">
              {teamList.map(({ member, profile }) => {
                const isSelected = selectedTeamMemberId === member.id;
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelectTeamMember(member.id, profile?.full_name)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
                        isSelected
                          ? "border-brand bg-brand/10 shadow-sm shadow-brand/10"
                          : "border-border-subtle bg-bg hover:border-border-strong"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="truncate text-xs font-bold text-white">
                          {profile?.full_name || "Team Member"}
                        </h3>
                        <span className="text-[10px] font-mono text-brand font-semibold">
                          {member.team_code}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-text-secondary mt-0.5">
                        {member.job_title}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">{profile?.email}</span>
                        <Pill tone={member.is_active ? "ok" : "bad"}>
                          {member.is_active ? "Active" : "Suspended"}
                        </Pill>
                      </div>
                    </button>
                  </li>
                );
              })}
              {!teamList.length && (
                <li className="py-6 text-center text-xs text-text-muted">No team members found.</li>
              )}
            </ul>
          )}
        </Panel>

        <div
          className={cn(
            "flex flex-col h-full gap-4 overflow-hidden",
            !isMobileDetailOpen ? "hidden xl:flex" : "flex",
          )}
        >
          <Panel
            title={
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="xl:hidden inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand hover:bg-white/5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-xs font-bold text-white">
                    {chatType === "team"
                      ? currentTeamMemberProfile
                        ? `Direct Chat with ${currentTeamMemberProfile.full_name}`
                        : "Direct Team Chat"
                      : active
                        ? `${active.reference} — ${active.title}`
                        : "Select a conversation"}
                  </span>
                  {chatType === "monitor" && active && (
                    <span className="text-[10px] text-text-muted truncate">
                      User: <strong className="text-text-secondary">{profileOf(active.user_id)?.full_name ?? "User"}</strong> • Assigned: <strong className="text-brand-light">{profileOf(active.assigned_team_id)?.full_name ?? "Unassigned"}</strong>
                    </span>
                  )}
                </div>
              </div>
            }
            className="flex-1 flex flex-col overflow-hidden"
            action={
              active && (
                <div className="flex items-center gap-2">
                  <ChatTagButton
                    requestId={active.id}
                    currentTags={active.tags ?? []}
                    onTagsUpdated={() => {
                      void fetchRequestsPage(page);
                      refresh();
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => startCall("audio", active.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-text-muted hover:border-brand/40 hover:text-brand transition-colors"
                      title="Start Audio Call"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => startCall("video", active.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-text-muted hover:border-brand/40 hover:text-brand transition-colors"
                      title="Start Video Call"
                    >
                      <Video className="h-3.5 w-3.5" />
                    </button>
                    {canShareScreen() && (
                      <button
                        onClick={() => startCall("screen", active.id)}
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
                    {messages.map((m) => {
                      const callLog = (m.reactions as any)?.call_log;
                      if (callLog) {
                        return (
                          <CallEventBubble
                            key={m.id}
                            callLog={callLog}
                            time={formatDate(m.created_at)}
                            currentUserId={currentAdminId ?? undefined}
                            onCallBack={(type) => startCall(type, active.id)}
                          />
                        );
                      }

                      const mine = currentAdminId && m.sender_id ? m.sender_id === currentAdminId : m.sender_role === "admin";
                      const senderDisplayName = m.sender_role === "admin"
                        ? "Admin (You)"
                        : m.sender_role === "user"
                          ? `${profileOf(active.user_id)?.full_name ?? "User"} (User)`
                          : `${profileOf(m.sender_id || active.assigned_team_id)?.full_name ?? "Support Agent"} (Team)`;

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
                                  {senderDisplayName}
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
                                  uploadedBy:
                                    m.attachment.uploader_role === "user" ? "User" : "Team",
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
                      <div className="flex flex-col items-center justify-center h-full text-text-muted py-12 text-center">
                        <MessageSquare className="h-8 w-8 opacity-30 mb-2" />
                        <p className="text-xs">
                          {chatType === "team"
                            ? "No direct messages yet. Say hello to your team member!"
                            : "No messages in this thread yet."}
                        </p>
                      </div>
                    )}
                    <div ref={endRef} />
                  </div>

                  <div className="mt-auto border-t border-border-subtle pt-4 bg-surface-1/50 -mx-4 px-4 pb-2 relative">
                    {/* Quick Replies Popup on '/' shortcut */}
                    {(showQuickReplies || draft.startsWith("/")) && quickReplies.length > 0 && (
                      <div className="absolute bottom-full left-4 mb-2 w-[min(20rem,calc(100vw-3rem))] max-h-64 overflow-y-auto rounded-2xl border border-border-subtle bg-surface-1 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="mb-2 px-2 pb-2 pt-1 text-[11px] font-semibold text-text-muted border-b border-border-subtle flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-white">
                            <Zap className="h-3.5 w-3.5 text-brand" /> Quick Replies
                          </span>
                          <span className="text-[10px] text-brand-light font-mono">
                            Type to filter
                          </span>
                        </div>
                        {(() => {
                          const query = draft.startsWith("/") ? draft.slice(1).trim().toLowerCase() : "";
                          const filtered = query
                            ? quickReplies.filter(
                                (qr) =>
                                  qr.title.toLowerCase().includes(query) ||
                                  qr.body.toLowerCase().includes(query),
                              )
                            : quickReplies;

                          if (filtered.length === 0) {
                            return (
                              <div className="p-3 text-center text-xs text-text-muted">
                                No quick replies match "{query}"
                              </div>
                            );
                          }

                          return filtered.map((qr) => (
                            <button
                              key={qr.id}
                              type="button"
                              className="w-full text-left rounded-xl px-3 py-2 text-sm text-text hover:bg-surface-2 transition-colors mb-1 group"
                              onClick={() => {
                                setDraft(qr.body);
                                setShowQuickReplies(false);
                              }}
                            >
                              <div className="font-semibold truncate text-xs text-white group-hover:text-brand transition-colors">
                                {qr.title}
                              </div>
                              <div className="text-[11px] text-text-muted truncate mt-0.5 leading-tight">
                                {qr.body}
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuickReplies((prev) => !prev)}
                        aria-label="Insert quick reply"
                        className={cn(
                          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 text-text transition-colors",
                          showQuickReplies || draft.startsWith("/")
                            ? "bg-surface-3 text-brand"
                            : "hover:bg-surface-3",
                        )}
                      >
                        <Zap className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <textarea
                        rows={1}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setShowQuickReplies(false);
                          }
                          if (e.key === "Enter" && !e.shiftKey) {
                            const query = draft.startsWith("/") ? draft.slice(1).trim().toLowerCase() : "";
                            if (draft.startsWith("/")) {
                              const filtered = query
                                ? quickReplies.filter(
                                    (qr) =>
                                      qr.title.toLowerCase().includes(query) ||
                                      qr.body.toLowerCase().includes(query),
                                  )
                                : quickReplies;
                              if (filtered.length > 0) {
                                e.preventDefault();
                                setDraft(filtered[0].body);
                                setShowQuickReplies(false);
                                return;
                              }
                            }
                            e.preventDefault();
                            void send();
                          }
                        }}
                        placeholder={
                          chatType === "team"
                            ? `Message ${currentTeamMemberProfile?.full_name || "Team Member"} directly (or '/' for quick replies)...`
                            : "Type a message as admin (or '/' for quick replies)..."
                        }
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
                    {chatType === "team" ? (
                      <section>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-3">
                          Team Member Details
                        </h4>
                        <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle space-y-2">
                          <div>
                            <p className="text-[10px] text-text-muted uppercase font-bold">Name</p>
                            <p className="text-xs text-white font-semibold">
                              {currentTeamMemberProfile?.full_name ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-text-muted uppercase font-bold">Email</p>
                            <p className="text-xs text-white font-mono text-[11px]">
                              {currentTeamMemberProfile?.email ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-text-muted uppercase font-bold">Role</p>
                            <p className="text-xs text-brand font-medium">Support Team</p>
                          </div>
                        </div>
                      </section>
                    ) : (
                      <>
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
                                <p className="text-[10px] text-text-muted uppercase font-bold">
                                  User
                                </p>
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
                      </>
                    )}
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
                  Pick a chat or team member from the left panel to start messaging.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
