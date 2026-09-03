import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTeamStore } from "@/lib/team-store";
import { getOrCreateAdminTeamChat } from "@/lib/api/admin-team-chat";
import { listMessages, sendMessage } from "@/lib/api/messages";
import { subscribeToRoom } from "@/lib/api/realtime";
import type { MessageRow, RequestRow, ChatRoomRow } from "@/lib/api/types";
import { setActiveChat } from "@/lib/active-chat-tracker";
import { useWebRTCCall } from "@/hooks/use-webrtc-call";
import { CallOverlay } from "@/components/chat/CallOverlay";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Phone,
  Video,
  ShieldCheck,
  Check,
  CheckCheck,
  Loader2,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/team/_shell/admin-chat")({
  component: TeamAdminChatPage,
  head: () => ({
    meta: [
      { title: "Admin Support — Formbhro Team" },
      {
        name: "description",
        content: "Direct internal communication channel between Team Members and Management.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

interface LocalMessage {
  id: string;
  senderRole: "team" | "admin";
  senderName: string;
  body: string | null;
  createdAt: string;
  delivery: "sending" | "delivered" | "failed";
  attachmentUrl?: string;
  attachmentName?: string;
}

function formatMsgTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function TeamAdminChatPage() {
  const navigate = useNavigate();
  const { member } = useTeamStore();
  const { height: viewportHeight } = useVisualViewport();

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [room, setRoom] = useState<ChatRoomRow | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. WebRTC Call integration for Admin direct communication
  const { session, startCall, acceptCall, hangup, switchCamera } = useWebRTCCall(request?.id);

  // 2. Initialize the Admin direct chat channel
  useEffect(() => {
    if (!member) return;
    let active = true;

    async function initAdminChat() {
      setLoading(true);
      try {
        const result = await getOrCreateAdminTeamChat(member!.id, member!.name);
        if (!active) return;

        setRequest(result.request);
        setRoom(result.room);

        // Track active chat so foreground push notifications are suppressed while looking at it
        setActiveChat({
          requestId: result.request.id,
          requestRef: result.request.reference || result.request.id,
          chatRoomId: result.room.id,
        });

        // Load existing conversation history
        if (result.room.id) {
          const fetched = await listMessages(result.room.id);
          if (!active) return;
          const mapped: LocalMessage[] = (fetched ?? []).map((m) => ({
            id: m.id,
            senderRole: m.sender_role === "admin" ? "admin" : "team",
            senderName: m.sender_role === "admin" ? "Admin Support" : member!.name || "You",
            body: m.body,
            createdAt: m.created_at,
            delivery: "delivered",
          }));
          setMessages(mapped);
        }
      } catch (err) {
        console.error("[TeamAdminChat] Failed to load direct channel:", err);
        if (active) {
          toast.error("Could not load Admin chat. Please try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initAdminChat();

    return () => {
      active = false;
      setActiveChat(null);
    };
  }, [member]);

  // 3. Realtime message streaming
  useEffect(() => {
    if (!room?.id) return;

    const unsubscribe = subscribeToRoom(room.id, {
      onMessage: (incoming: MessageRow) => {
        setMessages((prev) => {
          // If already exists, do not duplicate
          if (prev.some((m) => m.id === incoming.id)) {
            return prev.map((m) =>
              m.id === incoming.id
                ? {
                    ...m,
                    body: incoming.body,
                    delivery: "delivered",
                  }
                : m,
            );
          }

          // Check if there is an optimistic message with matching body
          const optIdx = prev.findIndex(
            (m) => m.delivery === "sending" && m.body === incoming.body && m.senderRole === "team",
          );
          if (optIdx >= 0) {
            const copy = [...prev];
            copy[optIdx] = {
              id: incoming.id,
              senderRole: "team",
              senderName: member?.name || "You",
              body: incoming.body,
              createdAt: incoming.created_at,
              delivery: "delivered",
            };
            return copy;
          }

          return [
            ...prev,
            {
              id: incoming.id,
              senderRole: incoming.sender_role === "admin" ? "admin" : "team",
              senderName:
                incoming.sender_role === "admin" ? "Admin Support" : member?.name || "You",
              body: incoming.body,
              createdAt: incoming.created_at,
              delivery: "delivered",
            },
          ];
        });
      },
      onMessageUpdate: (incoming: MessageRow) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === incoming.id ? { ...m, body: incoming.body } : m)),
        );
      },
    });

    return () => {
      unsubscribe();
    };
  }, [room?.id, member?.name]);

  // 4. Auto scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 5. Send Message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !room?.id || !request?.id || sending) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: LocalMessage = {
      id: tempId,
      senderRole: "team",
      senderName: member?.name || "You",
      body: trimmed,
      createdAt: new Date().toISOString(),
      delivery: "sending",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    setSending(true);

    try {
      const sent = await sendMessage({
        chatRoomId: room.id,
        requestId: request.id,
        body: trimmed,
        senderRole: "team",
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: sent.id,
                delivery: "delivered",
                createdAt: sent.created_at,
              }
            : m,
        ),
      );
    } catch (err) {
      console.error("[TeamAdminChat] Failed to send message:", err);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, delivery: "failed" } : m)));
      toast.error("Failed to send message to Admin.");
    } finally {
      setSending(false);
    }
  };

  // 6. Handle Attachment
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room?.id || !request?.id || !member) return;

    setUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}…`);

    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `admin-chats/${request.id}/${Date.now()}-${cleanName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;

      const attachmentBody = `Shared attachment: [${file.name}](${publicUrl})`;

      const sent = await sendMessage({
        chatRoomId: room.id,
        requestId: request.id,
        body: attachmentBody,
        senderRole: "team",
      });

      setMessages((prev) => [
        ...prev,
        {
          id: sent.id,
          senderRole: "team",
          senderName: member.name || "You",
          body: attachmentBody,
          createdAt: sent.created_at,
          delivery: "delivered",
          attachmentUrl: publicUrl,
          attachmentName: file.name,
        },
      ]);

      toast.success("Attachment sent to Admin", { id: toastId });
    } catch (err: any) {
      console.error("[TeamAdminChat] Upload failed:", err);
      toast.error(err.message || "Failed to upload attachment", { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="flex flex-col bg-bg text-text"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : "100vh",
        maxHeight: viewportHeight ? `${viewportHeight}px` : "100vh",
      }}
    >
      {/* WebRTC Audio/Video Call Overlay */}
      <CallOverlay
        session={session}
        onAccept={acceptCall}
        onHangup={hangup}
        onSwitchCamera={switchCamera}
      />

      {/* ===== HEADER ===== */}
      <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-1 px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] lg:pt-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                void navigate({ to: "/team" });
              }
            }}
            aria-label="Back to Team Home"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border-subtle bg-surface-2 text-text transition-colors hover:bg-surface-3"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
            <ShieldCheck className="h-5 w-5" />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-1 bg-emerald-500"
              aria-label="Online"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-bold text-text">Admin Support</h1>
              <span className="shrink-0 rounded-md bg-brand/15 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                Management
              </span>
            </div>
            <p className="truncate text-[11px] text-text-muted">
              {request
                ? `${request.reference || "ADM-TM"} • Direct Channel`
                : "Connecting to admin…"}
            </p>
          </div>
        </div>

        {/* Audio & Video Call Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => startCall("audio")}
            disabled={!request?.id || loading}
            aria-label="Start Voice Call with Admin"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border-subtle bg-surface-2 text-text transition-colors hover:bg-surface-3 hover:text-brand disabled:opacity-40"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => startCall("video")}
            disabled={!request?.id || loading}
            aria-label="Start Video Call with Admin"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border-subtle bg-surface-2 text-text transition-colors hover:bg-surface-3 hover:text-brand disabled:opacity-40"
          >
            <Video className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ===== CHAT MESSAGES AREA ===== */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <p className="text-xs text-text-muted">Connecting to Admin Support channel…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border-subtle bg-surface-2 text-brand">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-sm font-bold text-text">Direct Chat with Admin</h2>
            <p className="mt-1 max-w-xs text-xs text-text-muted">
              Use this channel to report issues, ask for operational guidance, or discuss leave and
              assignments directly with management.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((m) => {
              const isMine = m.senderRole === "team";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col max-w-[82%]",
                    isMine ? "self-end items-end" : "self-start items-start",
                  )}
                >
                  <span className="mb-1 px-1 text-[10px] font-medium text-text-muted">
                    {m.senderName}
                  </span>

                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words leading-relaxed",
                      isMine
                        ? "bg-brand text-white rounded-br-xs"
                        : "bg-surface-2 text-text border border-border-subtle rounded-bl-xs",
                    )}
                  >
                    {m.body}
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-text-muted">
                    <span>{formatMsgTime(m.createdAt)}</span>
                    {isMine && (
                      <span>
                        {m.delivery === "sending" && <Clock className="h-3 w-3 animate-spin" />}
                        {m.delivery === "delivered" && (
                          <CheckCheck className="h-3.5 w-3.5 text-brand" />
                        )}
                        {m.delivery === "failed" && (
                          <span className="flex items-center gap-0.5 text-rose-500 font-semibold">
                            <AlertCircle className="h-3 w-3" /> Failed
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </main>

      {/* ===== COMPOSER ===== */}
      <footer className="shrink-0 border-t border-border-subtle bg-surface-1 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <form onSubmit={handleSend} className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            aria-label="Attach document or screenshot"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border-subtle bg-surface-2 text-text-muted transition-colors hover:bg-surface-3 hover:text-text disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message to Admin Support…"
            disabled={loading || sending}
            className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />

          <button
            type="submit"
            disabled={!text.trim() || sending || loading}
            aria-label="Send message"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </footer>
    </div>
  );
}
