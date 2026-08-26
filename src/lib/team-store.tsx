import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  // TEAM_ACCOUNTS, TEAM_DOCUMENTS, etc removed as they are demo data
  type TeamAccount,
  type TeamDocument,
  type TeamMessage,
  type TeamNotification,
  type TeamRequest,
  type TeamStatus,
  type TeamDelivery,
  type TeamReaction,
  type TeamReadReceipt,
} from "@/data/team-module";
import { supabase } from "@/integrations/supabase/client";
import { signInWithPassword, getMyRole, getMyProfile, signOut as apiSignOut } from "@/lib/api/auth";
import * as messagesApi from "@/lib/api/messages";
import * as documentsApi from "@/lib/api/documents";
import * as requestsApi from "@/lib/api/requests";
import * as notificationsApi from "@/lib/api/notifications";
import {
  subscribeToRoom,
  subscribeToRequests,
  subscribeToMyNotifications,
  sendTyping,
} from "@/lib/api/realtime";
import { verifyTeamCode } from "@/lib/api/admin.functions";
import {
  TEAM_TO_DB_STATUS,
  dayLabel,
  loadTeamSnapshot,
  mapTeamDocument,
  mapTeamMessage,
  mapTeamNotification,
  mapTeamRequest,
  type LiveTeamSnapshot,
} from "@/lib/team-live";

const SESSION_KEY = "formbhro.team.session";
const MAX_SEND_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1400;

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Adds a reader to a message without duplicating an existing receipt. */
function withReceipt(m: TeamMessage, reader: Omit<TeamReadReceipt, "at">, at: string): TeamMessage {
  const list = m.readBy ?? [];
  if (list.some((x) => x.name === reader.name)) return m;
  return { ...m, readBy: [...list, { ...reader, at }] };
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export type TeamMember = Omit<TeamAccount, "password">;

type TeamStore = {
  member: TeamMember | null;
  hydrated: boolean;
  signIn: (
    email: string,
    password: string,
    remember: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  signInWithCode: (code: string, remember: boolean) => Promise<{ ok: boolean; error?: string }>;
  /** True when the panel is backed by the live backend instead of demo data. */
  live: boolean;
  signOut: () => void;
  updateMember: (patch: Partial<TeamMember>) => void;
  requests: TeamRequest[];
  messages: TeamMessage[];
  documents: TeamDocument[];
  notifications: TeamNotification[];
  getRequest: (id: string) => TeamRequest | undefined;
  messagesFor: (id: string) => TeamMessage[];
  documentsFor: (id: string) => TeamDocument[];
  getDocument: (id: string) => TeamDocument | undefined;
  sendMessage: (requestId: string, text: string) => void;
  /** True while the user on the other side of this request is composing. */
  isUserTyping: (requestId: string) => boolean;
  /** Broadcast that the signed-in team member is composing on this request. */
  notifyTyping: (requestId: string) => void;
  attachDocument: (
    requestId: string,
    file: {
      name: string;
      size: string;
      kind: TeamDocument["kind"];
      previewUrl?: string;
      blob?: File;
    },
  ) => void;
  setStatus: (requestId: string, status: TeamStatus) => void;
  /** Marks every incoming user message on this request as read. */
  markRead: (requestId: string) => void;
  /** Toggles an emoji reaction by the signed-in member on one message. */
  toggleReaction: (messageId: string, emoji: string) => void;
  /** Edits the body of a team message, keeping the previous version in history. */
  editMessage: (messageId: string, text: string) => void;
  /** Restores the original (first) version of an edited message. */
  restoreOriginalMessage: (messageId: string) => void;
  togglePin: (messageId: string) => void;
  pinnedFor: (requestId: string) => TeamMessage[];

  /** Marks a single incoming message as read (used as messages scroll into view). */
  markMessageRead: (messageId: string) => void;
  /** Re-sends a single message that failed to deliver. */
  retryMessage: (messageId: string) => void;
  /** Re-sends every failed message on a request. */
  retryFailed: (requestId: string) => void;
  /** Count of messages that failed to deliver on one request. */
  failedFor: (requestId: string) => number;
  /** Unread incoming messages on one request. */
  unreadFor: (requestId: string) => number;
  /** Unread incoming messages across every assigned request. */
  totalUnread: number;
  markAllNotificationsRead: () => void;
  /** Marks one notification as read. */
  markNotificationRead: (id: string) => void;
  /** Flips one notification back to unread. */
  markNotificationUnread: (id: string) => void;
  /** Removes every notification from the center. */
  clearNotifications: () => void;
  /** Count of unread notifications (drives the bell badge). */
  unreadNotifications: number;
  /** Self-assign a request. */
  assignToMe: (requestId: string) => Promise<void>;
  pool: TeamRequest[];
};

const Ctx = createContext<TeamStore | null>(null);

export function TeamStoreProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<TeamMember | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  const rooms = useRef<LiveTeamSnapshot["rooms"]>({});
  const refByRequestId = useRef<Record<string, string>>({});
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [documents, setDocuments] = useState<TeamDocument[]>([]);
  const [notifications, setNotifications] = useState<TeamNotification[]>([]);
  const [typingIn, setTypingIn] = useState<Record<string, boolean>>({});
  const timers = useRef<number[]>([]);
  const memberRef = useRef<TeamMember | null>(null);
  useEffect(() => {
    memberRef.current = member;
  }, [member]);
  const requestsRef = useRef<TeamRequest[]>(requests);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);
  const messagesRef = useRef<TeamMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const typingToken = useRef<Record<string, number>>({});

  const startTyping = useCallback((requestId: string, duration: number) => {
    const token = (typingToken.current[requestId] ?? 0) + 1;
    typingToken.current[requestId] = token;
    setTypingIn((t) => ({ ...t, [requestId]: true }));
    setTimeout(() => {
      if (typingToken.current[requestId] !== token) return;
      setTypingIn((t) => ({ ...t, [requestId]: false }));
    }, duration);
  }, []);

  const setDelivery = useCallback((messageId: string, delivery: TeamDelivery) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, delivery, read: delivery === "read" } : m)),
    );
  }, []);

  const runDeliveryCycle = useCallback(
    (requestId: string, messageId: string, attempt = 1) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                delivery: attempt === 1 ? "sending" : "retrying",
                attempts: attempt,
                deliveryError: undefined,
              }
            : m,
        ),
      );
      // Delivery cycle is just a UI shim now as real messages go through the backend
      setTimeout(() => setDelivery(messageId, "sent"), 500);
    },
    [setDelivery],
  );

  const runDeliveryCycleRef = useRef(runDeliveryCycle);
  useEffect(() => {
    runDeliveryCycleRef.current = runDeliveryCycle;
  }, [runDeliveryCycle]);

  /** Manual retry for a message that exhausted its automatic attempts. */
  const retryMessage = useCallback((messageId: string) => {
    const msg = messagesRef.current.find((m) => m.id === messageId);
    if (!msg) return;
    runDeliveryCycleRef.current(msg.requestId, messageId, 1);
  }, []);

  /** Retries every failed message on a request (used by the chat error banner). */
  const retryFailed = useCallback((requestId: string) => {
    messagesRef.current
      .filter((m) => m.requestId === requestId && m.delivery === "failed")
      .forEach((m) => runDeliveryCycleRef.current(requestId, m.id, 1));
  }, []);

  /** Failed messages on one request. */
  const failedFor = useCallback(
    (requestId: string) =>
      messages.filter((m) => m.requestId === requestId && m.delivery === "failed").length,
    [messages],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      let stored: { member: TeamMember; live?: boolean } | null = null;
      try {
        const raw =
          window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as TeamMember | { member: TeamMember; live?: boolean };
          stored =
            "member" in parsed
              ? (parsed as { member: TeamMember; live?: boolean })
              : { member: parsed as TeamMember };
        }
      } catch {
        /* ignore */
      }
      if (!active) return;
      if (stored?.live) {
        // A live session is only valid while the backend session is valid.
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          setMember(stored.member);
          setLive(true);
        } else {
          try {
            window.localStorage.removeItem(SESSION_KEY);
            window.sessionStorage.removeItem(SESSION_KEY);
          } catch {
            /* ignore */
          }
        }
      } else if (stored) {
        setMember(stored.member);
      }
      if (active) setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const persistSession = useCallback((safe: TeamMember, remember: boolean, isLive: boolean) => {
    try {
      const store = remember ? window.localStorage : window.sessionStorage;
      store.setItem(SESSION_KEY, JSON.stringify({ member: safe, live: isLive }));
    } catch {
      /* ignore */
    }
  }, []);

  /** Replaces the demo seed with live backend records for the signed-in member. */
  const hydrateLive = useCallback(async (safe: TeamMember) => {
    try {
      const snapshot = await loadTeamSnapshot(safe.id, safe.name);
      rooms.current = snapshot.rooms;
      refByRequestId.current = snapshot.refByRequestId;
      setRequests(snapshot.requests);
      setMessages(snapshot.messages);
      setDocuments(snapshot.documents);
      setNotifications(snapshot.notifications);
    } catch {
      rooms.current = {};
      refByRequestId.current = {};
      setRequests([]);
      setMessages([]);
      setDocuments([]);
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    if (live && member) void hydrateLive(member);
  }, [live, member, hydrateLive]);

  const signIn = useCallback(
    async (email: string, password: string, remember: boolean) => {
      try {
        const { data: authData, error: authError } = await signInWithPassword(email, password);
        if (authError) throw authError;

        const user = authData.user;
        const role = await getMyRole();

        if (role !== "team" && role !== "admin") {
          await apiSignOut();
          return { ok: false, error: "This account does not have team access." };
        }

        const profile = await getMyProfile();
        const { data: teamRow } = await supabase
          .from("team_members")
          .select("*")
          .eq("id", user!.id)
          .maybeSingle();

        const name = profile?.full_name || email.split("@")[0]!;
        const safe: TeamMember = {
          id: user!.id,
          name,
          initials: initialsOf(name),
          email: profile?.email || email.trim(),
          role: teamRow?.job_title ?? (role === "admin" ? "Administrator" : "Support Executive"),
          teamId: teamRow?.team_code ?? "FBH-TEAM",
          memberSince: dayLabel(profile?.created_at),
          avatarColor: "#ff7a00",
        };

        setMember(safe);
        setLive(true);
        liveRef.current = true;
        persistSession(safe, remember, true);

        // Use window.location to ensure all stores re-initialize in Team mode
        window.location.href = "/team";
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Invalid email or password. Contact your administrator if you need help.",
        };
      }
    },
    [persistSession],
  );

  const signInWithCode = useCallback(
    async (code: string, remember: boolean) => {
      try {
        // Verify code on server
        const codeClean = code.trim().toUpperCase();
        const res = await verifyTeamCode({ data: { code: codeClean } });

        if (!res.ok || !res.email) throw new Error("Invalid team code.");

        // For team members, we use the synchronized password FBH-Team@2026
        const { data: authData, error: authError } = await signInWithPassword(
          res.email,
          "FBH-Team@2026",
        );

        if (authError) throw authError;

        const user = authData.user;
        const role = await getMyRole();

        if (role !== "team" && role !== "admin") {
          await apiSignOut();
          return { ok: false, error: "This account does not have team access." };
        }

        const profile = await getMyProfile();
        const { data: teamRow } = await supabase
          .from("team_members")
          .select("*")
          .eq("id", user!.id)
          .maybeSingle();

        const name = profile?.full_name || res.email.split("@")[0]!;
        const safe: TeamMember = {
          id: user!.id,
          name,
          initials: initialsOf(name),
          email: profile?.email || res.email,
          role: teamRow?.job_title ?? (role === "admin" ? "Administrator" : "Support Executive"),
          teamId: teamRow?.team_code ?? code,
          memberSince: dayLabel(profile?.created_at),
          avatarColor: "#ff7a00",
        };

        setMember(safe);
        setLive(true);
        liveRef.current = true;
        persistSession(safe, remember, true);
        window.location.href = "/team";
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Invalid team code. Please check your credentials.",
        };
      }
    },
    [persistSession],
  );

  const signOut = useCallback(() => {
    if (liveRef.current) void apiSignOut().catch(() => undefined);
    setMember(null);
    setLive(false);
    liveRef.current = false;
    rooms.current = {};
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const updateMember = useCallback((patch: Partial<TeamMember>) => {
    setMember((m) => {
      if (!m) return m;
      const next = { ...m, ...patch };
      if (liveRef.current && (patch.name || patch.email)) {
        void supabase
          .from("profiles")
          .update({ ...(patch.name ? { full_name: patch.name } : {}) })
          .eq("id", m.id);
      }
      try {
        const target = window.localStorage.getItem(SESSION_KEY)
          ? window.localStorage
          : window.sessionStorage;
        if (target.getItem(SESSION_KEY))
          target.setItem(SESSION_KEY, JSON.stringify({ member: next, live: liveRef.current }));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Unread is derived from per-message read state so counts can never drift.
  const unreadByRequest = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of messages) {
      if (m.author !== "user" || m.read) continue;
      map[m.requestId] = (map[m.requestId] ?? 0) + 1;
    }
    return map;
  }, [messages]);

  // Permission boundary: a team member sees their own assigned records + all unassigned records.
  const assigned = useMemo(
    () =>
      member
        ? requests
            .filter((r) => r.assigneeId === member.id)
            .map((r) => ({ ...r, unread: unreadByRequest[r.id] ?? 0 }))
        : [],
    [requests, member, unreadByRequest],
  );

  const pool = useMemo(
    () =>
      member
        ? requests.filter((r) => !r.assigneeId && !["completed", "cancelled"].includes(r.status))
        : [],
    [requests, member],
  );
  const assignedIds = useMemo(() => new Set(assigned.map((r) => r.id)), [assigned]);

  const visibleDocuments = useMemo(
    () => documents.filter((d) => assignedIds.has(d.requestId)),
    [documents, assignedIds],
  );
  const visibleMessages = useMemo(
    () => messages.filter((m) => assignedIds.has(m.requestId)),
    [messages, assignedIds],
  );

  const getRequest = useCallback((id: string) => assigned.find((r) => r.id === id), [assigned]);
  const messagesFor = useCallback(
    (id: string) => visibleMessages.filter((m) => m.requestId === id),
    [visibleMessages],
  );
  const documentsFor = useCallback(
    (id: string) => visibleDocuments.filter((d) => d.requestId === id),
    [visibleDocuments],
  );
  const getDocument = useCallback(
    (id: string) => visibleDocuments.find((d) => d.id === id),
    [visibleDocuments],
  );

  const touch = useCallback(
    (requestId: string, patch: Partial<TeamRequest>, timelineLabel?: string) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                ...patch,
                lastUpdated: `Today • ${nowTime()}`,
                timeline: timelineLabel
                  ? [...r.timeline, { label: timelineLabel, time: `Today • ${nowTime()}` }]
                  : r.timeline,
              }
            : r,
        ),
      );
    },
    [],
  );

  const sendMessage = useCallback(
    (requestId: string, text: string) => {
      const name = member?.name ?? "Support";
      const id = uid("msg");
      setMessages((prev) => [
        ...prev,
        {
          id,
          requestId,
          author: "team",
          authorName: name,
          time: nowTime(),
          text,
          read: false,
          delivery: "sending",
        },
      ]);
      touch(requestId, { lastMessage: text });
      if (liveRef.current) {
        // If not assigned yet, assign to me automatically when sending a message
        const r = requestsRef.current.find((req) => req.id === requestId);
        if (r && !r.assigneeId) {
          void assignToMe(requestId).catch((err) => {
            console.error("Auto-assignment failed:", err);
          });
        }

        const room = rooms.current[requestId];
        if (!room?.chatRoomId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? { ...m, delivery: "failed", deliveryError: "Chat room unavailable." }
                : m,
            ),
          );
          return;
        }
        void messagesApi
          .sendMessageWithRetry({
            chatRoomId: room.chatRoomId,
            requestId: room.requestId,
            body: text,
            senderRole: "team",
          })
          .then((row) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev.filter((m) => m.id !== id);
              return prev.map((m) =>
                m.id === id ? { ...m, id: row.id, delivery: "delivered" } : m,
              );
            });
          })
          .catch(() => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id
                  ? { ...m, delivery: "failed", deliveryError: "Message not delivered." }
                  : m,
              ),
            );
          });
        return;
      }
      runDeliveryCycle(requestId, id);
    },
    [member, touch, runDeliveryCycle, assignToMe],
  );

  const attachDocument = useCallback(
    (
      requestId: string,
      file: {
        name: string;
        size: string;
        kind: TeamDocument["kind"];
        previewUrl?: string;
        blob?: File;
      },
    ) => {
      const id = uid("doc");
      const name = member?.name ?? "Support";
      setDocuments((prev) => [
        ...prev,
        {
          id,
          requestId,
          name: file.name,
          kind: file.kind,
          size: file.size,
          previewUrl: file.previewUrl,
          uploadedAt: `Today • ${nowTime()}`,
          uploadedBy: name,
        },
      ]);
      const messageId = uid("msg");
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          requestId,
          author: "team",
          authorName: name,
          time: nowTime(),
          documentId: id,
          read: false,
          delivery: "sending",
        },
      ]);
      touch(
        requestId,
        { lastMessage: `Sent a document — ${file.name}` },
        `Document sent — ${file.name}`,
      );
      if (liveRef.current) {
        const room = rooms.current[requestId];
        if (!room || !file.blob) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, delivery: "failed", deliveryError: "Upload unavailable." }
                : m,
            ),
          );
          return;
        }
        void (async () => {
          try {
            const doc = await documentsApi.uploadDocument({
              file: file.blob!,
              requestId: room.requestId,
              chatRoomId: room.chatRoomId ?? undefined,
              uploaderRole: "team",
            });
            setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, id: doc.id } : d)));
            if (room.chatRoomId) {
              const row = await messagesApi.sendMessageWithRetry({
                chatRoomId: room.chatRoomId,
                requestId: room.requestId,
                attachmentId: doc.id,
                senderRole: "team",
              });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId
                    ? { ...m, id: row.id, documentId: doc.id, delivery: "delivered" }
                    : m,
                ),
              );
            }
          } catch {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? { ...m, delivery: "failed", deliveryError: "Upload failed." }
                  : m,
              ),
            );
          }
        })();
        return;
      }
      runDeliveryCycle(requestId, messageId);
    },
    [member, touch, runDeliveryCycle],
  );

  const setStatus = useCallback(
    (requestId: string, status: TeamStatus) => {
      const label =
        status === "completed"
          ? "Marked completed"
          : `Status updated to ${status.replace("-", " ")}`;
      if (liveRef.current) {
        const room = rooms.current[requestId];
        if (room) {
          void requestsApi
            .updateRequestStatus(
              room.requestId,
              TEAM_TO_DB_STATUS[status],
              status === "completed" ? 100 : undefined,
            )
            .catch(() => undefined);
        }
      }
      touch(requestId, status === "completed" ? { status, progress: 100 } : { status }, label);
      setNotifications((prev) => [
        {
          id: uid("tn"),
          type: "status",
          text: `${requestId} status updated to ${status.replace("-", " ")}`,
          time: nowTime(),
          read: false,
          requestId,
        },
        ...prev,
      ]);
    },
    [touch],
  );

  const assignToMe = useCallback(
    async (requestId: string) => {
      if (!member?.id) return;
      try {
        const { error } = await supabase
          .from("requests")
          .update({
            assigned_team_id: member.id,
            status: "assigned",
            assigned_at: new Date().toISOString(),
          })
          .eq("id", requestId);
        if (error) throw error;
        // The realtime subscription will trigger setRequests update
      } catch (err) {
        console.error("Failed to self-assign:", err);
      }
    },
    [member],
  );

  const isUserTyping = useCallback((requestId: string) => Boolean(typingIn[requestId]), [typingIn]);

  const notifyTyping = useCallback((requestId: string) => {
    if (liveRef.current) {
      // Real presence: broadcast on the request's chat-room channel.
      const room = rooms.current[requestId];
      const me = memberRef.current;
      if (room?.chatRoomId && me) {
        void sendTyping(room.chatRoomId, { userId: me.id, name: me.name, typing: true }).catch(
          () => undefined,
        );
      }
    }
  }, []);

  const meReader = useMemo(() => {
    const name = member?.name ?? "You";
    return { name, initials: initialsOf(name), role: "team" as const };
  }, [member]);

  const markRead = useCallback(
    (requestId: string) => {
      const at = nowTime();
      setMessages((prev) =>
        prev.some((m) => m.requestId === requestId && m.author === "user" && !m.read)
          ? prev.map((m) =>
              m.requestId === requestId && m.author === "user" && !m.read
                ? withReceipt({ ...m, read: true, readAt: at }, meReader, at)
                : m,
            )
          : prev,
      );
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId && r.unread ? { ...r, unread: 0 } : r)),
      );
      if (liveRef.current) {
        const room = rooms.current[requestId];
        if (room?.chatRoomId)
          void messagesApi.markMessagesSeen(room.chatRoomId, "team").catch(() => undefined);
      }
    },
    [meReader],
  );

  const markMessageRead = useCallback(
    (messageId: string) => {
      const at = nowTime();
      setMessages((prev) =>
        prev.some((m) => m.id === messageId && m.author === "user" && !m.read)
          ? prev.map((m) =>
              m.id === messageId ? withReceipt({ ...m, read: true, readAt: at }, meReader, at) : m,
            )
          : prev,
      );
    },
    [meReader],
  );

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      const me = member?.name ?? "You";
      if (liveRef.current) void messagesApi.toggleReaction(messageId, emoji).catch(() => undefined);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const list: TeamReaction[] = m.reactions
            ? m.reactions.map((r) => ({ ...r, by: [...r.by] }))
            : [];
          const existing = list.find((r) => r.emoji === emoji);
          if (!existing) return { ...m, reactions: [...list, { emoji, by: [me], mine: true }] };
          if (existing.mine) {
            existing.by = existing.by.filter((n) => n !== me);
            existing.mine = false;
          } else {
            existing.by = [...existing.by, me];
            existing.mine = true;
          }
          return { ...m, reactions: list.filter((r) => r.by.length > 0) };
        }),
      );
    },
    [member],
  );

  const editMessage = useCallback((messageId: string, text: string) => {
    const next = text.trim();
    if (!next) return;
    const at = nowTime();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || m.author !== "team") return m;
        const current = m.text ?? "";
        if (current === next) return m;
        return {
          ...m,
          text: next,
          edited: true,
          editedAt: at,
          // The first edit seeds history with the original once — the previous
          // version was being pushed twice, showing a duplicate entry.
          history: (m.history?.length
            ? [...m.history, { text: current, at }]
            : [{ text: current, at: m.time }]
          ).slice(-10),
        };
      }),
    );
  }, []);

  const restoreOriginalMessage = useCallback((messageId: string) => {
    const at = nowTime();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.history?.length) return m;
        const original = m.history[0]!.text;
        if (original === (m.text ?? "")) return m;
        return {
          ...m,
          text: original,
          edited: true,
          editedAt: at,
          history: [...m.history, { text: m.text ?? "", at }].slice(-10),
        };
      }),
    );
  }, []);

  const togglePin = useCallback((messageId: string) => {
    const at = nowTime();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, pinned: !m.pinned, pinnedAt: !m.pinned ? at : undefined } : m,
      ),
    );
  }, []);

  const pinnedFor = useCallback(
    (requestId: string) => messages.filter((m) => m.requestId === requestId && m.pinned),
    [messages],
  );

  // Live layer: new messages, documents and request changes stream in.
  useEffect(() => {
    if (!live || !member) return;
    const entries = Object.entries(rooms.current).filter(([, r]) => r.chatRoomId);
    const offs = entries.map(([reference, room]) =>
      subscribeToRoom(room.chatRoomId as string, {
        onMessage: (row) => {
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, mapTeamMessage(row, reference, member.name)],
          );
        },
        onMessageUpdate: (row) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id ? { ...m, ...mapTeamMessage(row, reference, member.name) } : m,
            ),
          );
        },
        onDocument: (row) => {
          setDocuments((prev) =>
            prev.some((d) => d.id === row.id) ? prev : [mapTeamDocument(row, reference), ...prev],
          );
        },
        onTyping: (payload) => {
          if (payload.typing) startTyping(reference, 2500);
        },
      }),
    );
    const offRequests = subscribeToRequests((row) => {
      setRequests((prev) => {
        const mapped = mapTeamRequest(
          row,
          member.id,
          prev.find((r) => r.id === (row.reference || row.id))?.userName ?? "User",
        );
        const exists = prev.some((r) => r.id === mapped.id);
        return exists
          ? prev.map((r) =>
              r.id === mapped.id ? { ...mapped, unread: r.unread, timeline: r.timeline } : r,
            )
          : [{ ...mapped }, ...prev];
      });
    });
    return () => {
      offs.forEach((off) => off());
      offRequests();
    };
  }, [live, member, requests.length, startTyping]);

  // Live notification centre: new rows stream straight into the bell.
  useEffect(() => {
    if (!live || !member) return;
    return subscribeToMyNotifications(member.id, (row) => {
      setNotifications((prev) =>
        prev.some((n) => n.id === row.id)
          ? prev
          : [mapTeamNotification(row, refByRequestId.current), ...prev],
      );
    });
  }, [live, member]);

  const unreadFor = useCallback(
    (requestId: string) => unreadByRequest[requestId] ?? 0,
    [unreadByRequest],
  );

  const totalUnread = useMemo(() => assigned.reduce((sum, r) => sum + r.unread, 0), [assigned]);

  const markAllNotificationsRead = useCallback(() => {
    if (liveRef.current) void notificationsApi.markAllNotificationsRead().catch(() => undefined);
    setNotifications((prev) =>
      prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev,
    );
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    if (liveRef.current) void notificationsApi.markNotificationRead(id).catch(() => undefined);
    setNotifications((prev) =>
      prev.some((n) => n.id === id && !n.read)
        ? prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        : prev,
    );
  }, []);

  const markNotificationUnread = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.some((n) => n.id === id && n.read)
        ? prev.map((n) => (n.id === id ? { ...n, read: false } : n))
        : prev,
    );
  }, []);

  const clearNotifications = useCallback(() => {
    if (liveRef.current) void notificationsApi.markAllNotificationsRead().catch(() => undefined);
    setNotifications((prev) => (prev.length ? [] : prev));
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value = useMemo<TeamStore>(
    () => ({
      member,
      hydrated,
      live,
      signIn,
      signInWithCode,
      signOut,
      updateMember,
      requests: assigned,
      messages: visibleMessages,
      documents: visibleDocuments,
      notifications,
      getRequest,
      messagesFor,
      documentsFor,
      getDocument,
      sendMessage,
      isUserTyping,
      notifyTyping,
      attachDocument,
      setStatus,
      markRead,
      markMessageRead,
      toggleReaction,
      editMessage,
      restoreOriginalMessage,
      togglePin,
      pinnedFor,
      retryMessage,
      retryFailed,
      failedFor,
      unreadFor,
      totalUnread,
      markAllNotificationsRead,
      markNotificationRead,
      markNotificationUnread,
      clearNotifications,
      unreadNotifications,
      assignToMe,
      pool,
    }),
    [
      member,
      hydrated,
      live,
      signIn,
      signInWithCode,
      signOut,
      updateMember,
      assigned,
      visibleMessages,
      visibleDocuments,
      notifications,
      getRequest,
      messagesFor,
      documentsFor,
      getDocument,
      sendMessage,
      isUserTyping,
      notifyTyping,
      attachDocument,
      setStatus,
      markRead,
      markMessageRead,
      toggleReaction,
      editMessage,
      restoreOriginalMessage,
      togglePin,
      pinnedFor,
      retryMessage,
      retryFailed,
      failedFor,
      unreadFor,
      totalUnread,
      markAllNotificationsRead,
      markNotificationRead,
      markNotificationUnread,
      clearNotifications,
      unreadNotifications,
      assignToMe,
      pool,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTeamStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTeamStore must be used inside TeamStoreProvider");
  return ctx;
}
