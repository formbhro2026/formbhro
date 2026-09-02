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
import { toast } from "sonner";
import { playMessageNotificationSound } from "@/lib/audio-notifications";
import { showSystemNotification } from "@/lib/fcm";
import { isChatActive } from "@/lib/active-chat-tracker";
import { signInWithPassword, getMyRole, getMyProfile, signOut as apiSignOut } from "@/lib/api/auth";
import { markMessagesSeen } from "./api/messages";
import { assignRequest, updateRequestStatus, getTeamAnalytics } from "./api/requests";
import type { Database } from "@/integrations/supabase/types";
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
import { getOrCreateAdminTeamChat } from "@/lib/api/admin-team-chat";
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
  signInWithTeamAuth: (
    email: string,
    password: string,
    code: string,
    remember: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** True when the panel is backed by the live backend instead of demo data. */
  live: boolean;
  signOut: () => void;
  updateMember: (patch: Partial<TeamMember>) => Promise<TeamMember | null>;
  analytics: { assigned: number; completed: number; pending: number };
  fetchAnalytics: () => void;
  requests: TeamRequest[];
  requestsHasMore: boolean;
  requestsLoadingMore: boolean;
  requestsPage: number;
  loadMoreRequests: () => Promise<void>;
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
  deleteDocument: (documentId: string, storagePath?: string) => Promise<void>;
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
  /** Transfer request to another team member. */
  transferChat: (requestId: string, targetAssigneeId: string) => Promise<void>;
  /** Escalate request to Admin attention. */
  escalateChat: (requestId: string) => Promise<void>;
  /** Open direct chat thread with Admin. */
  openAdminChat: () => Promise<string | null>;
  /** Update tags on a request in local store */
  updateTags: (requestId: string, tags: string[]) => void;
  pool: TeamRequest[];
  loading: boolean;
};

const Ctx = createContext<TeamStore | null>(null);

export function TeamStoreProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<TeamMember | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  const rooms = useRef<LiveTeamSnapshot["rooms"]>({});
  const refByRequestId = useRef<Record<string, string>>({});
  const [analytics, setAnalytics] = useState({ assigned: 0, completed: 0, pending: 0 });
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [requestsHasMore, setRequestsHasMore] = useState(false);
  const [requestsLoadingMore, setRequestsLoadingMore] = useState(false);
  const [roomsTick, setRoomsTick] = useState(0);
  const [requestsPage, setRequestsPage] = useState(1);
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

  const sendMessageApi = useCallback(async (msgId: string, requestId: string, text: string) => {
    let room = rooms.current[requestId];

    // If no chatRoomId in our local state, try to create/fetch the room on-the-fly.
    if (!room?.chatRoomId) {
      try {
        const freshRoom = await requestsApi.getOrCreateChatRoom(requestId);
        // Cache it so subsequent sends don't need to re-fetch
        rooms.current[requestId] = { requestId, chatRoomId: freshRoom.id };
        room = rooms.current[requestId];
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, delivery: "failed", deliveryError: "Chat room unavailable." }
              : m,
          ),
        );
        return;
      }
    }

    try {
      const row = await messagesApi.sendMessageWithRetry({
        chatRoomId: room.chatRoomId!,
        requestId: room.requestId,
        body: text,
        senderRole: "team",
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev.filter((m) => m.id !== msgId);
        return prev.map((m) => (m.id === msgId ? { ...m, id: row.id, delivery: "delivered" } : m));
      });
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, delivery: "failed", deliveryError: "Message not delivered." }
            : m,
        ),
      );
    }
  }, []);

  /** Manual retry for a message that exhausted its automatic attempts. */
  const retryMessage = useCallback(
    (messageId: string) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      if (!msg || !msg.text) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, delivery: "retrying", deliveryError: undefined } : m,
        ),
      );
      void sendMessageApi(messageId, msg.requestId, msg.text);
    },
    [sendMessageApi],
  );

  /** Retries every failed message on a request (used by the chat error banner). */
  const retryFailed = useCallback(
    (requestId: string) => {
      messagesRef.current
        .filter((m) => m.requestId === requestId && m.delivery === "failed" && m.text)
        .forEach((m) => {
          setMessages((prev) =>
            prev.map((pm) =>
              pm.id === m.id ? { ...pm, delivery: "retrying", deliveryError: undefined } : pm,
            ),
          );
          void sendMessageApi(m.id, requestId, m.text!);
        });
    },
    [sendMessageApi],
  );

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
      if (stored) {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session && data.session.user && data.session.user.id === stored.member.id) {
          setMember(stored.member);
          setLive(true);
          persistSession(stored.member, true, true);
        } else {
          try {
            window.localStorage.removeItem(SESSION_KEY);
            window.sessionStorage.removeItem(SESSION_KEY);
          } catch {
            /* ignore */
          }
          if (active) setLoading(false);
        }
      } else {
        if (active) setLoading(false);
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
    setLoading(true);
    try {
      const snapshot = await loadTeamSnapshot(safe.id, safe.name);
      rooms.current = snapshot.rooms;
      refByRequestId.current = snapshot.refByRequestId;
      setRequests(snapshot.requests);
      setRequestsHasMore(snapshot.requestsHasMore);
      setRequestsPage(1);
      setMessages(snapshot.messages);
      setDocuments(snapshot.documents);
      setNotifications(snapshot.notifications);
    } catch {
      rooms.current = {};
      refByRequestId.current = {};
      setRequests([]);
      setRequestsHasMore(false);
      setRequestsPage(1);
      setMessages([]);
      setDocuments([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(() => {
    if (!liveRef.current || !memberRef.current) return;
    getTeamAnalytics()
      .then(setAnalytics)
      .catch((err) => console.error("Failed to fetch team analytics", err));
  }, []);

  const loadMoreRequests = useCallback(async () => {
    if (!liveRef.current || !memberRef.current || requestsLoadingMore || !requestsHasMore) return;
    setRequestsLoadingMore(true);
    try {
      const limit = 20;
      const nextPage = requestsPage + 1;
      const { data: rows, count } = await requestsApi.listRequestsPaginated({
        archived: false,
        limit,
        offset: requestsPage * limit,
      });

      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const names: Record<string, string> = {};
      if (userIds.length) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        for (const p of data ?? []) names[p.id] = p.full_name || p.email || "User";
      }

      setRequests((prev) => {
        const currentIds = new Set(prev.map((r) => r.id));
        const added = rows
          .filter((r) => !currentIds.has(r.reference || r.id))
          .map((r) => mapTeamRequest(r, memberRef.current!.id, names[r.user_id] ?? "User"));
        const next = [...prev, ...added];
        return next.length > 500 ? next.slice(0, 500) : next;
      });

      setRequestsHasMore(count > nextPage * limit);
      setRequestsPage(nextPage);
    } catch (err) {
      console.error("Failed to load more requests", err);
    } finally {
      setRequestsLoadingMore(false);
    }
  }, [requestsLoadingMore, requestsHasMore, requestsPage]);

  useEffect(() => {
    if (live && member) {
      void hydrateLive(member);
      fetchAnalytics();
      // Request browser notification permission so new-message alerts can fire
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
      
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          void hydrateLive(member);
          fetchAnalytics();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    } else if (hydrated && !member) {
      setLoading(false);
    }
  }, [live, member, hydrated, hydrateLive, fetchAnalytics]);

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

  const signInWithTeamAuth = useCallback(
    async (email: string, password: string, code: string, remember: boolean) => {
      try {
        // 1. Authenticate identity via Supabase Auth
        const { data: authData, error: authError } = await signInWithPassword(email, password);
        if (authError) throw authError;

        // 2. Verify authorization code securely on the backend using the new session
        const codeClean = code.trim().toUpperCase();
        const res = await verifyTeamCode({ data: { code: codeClean } });

        if (!res.ok) {
          await apiSignOut();
          throw new Error("Invalid team code or insufficient privileges.");
        }

        const user = authData.user;
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
          role: teamRow?.job_title ?? "Support Executive",
          teamId: teamRow?.team_code ?? codeClean,
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
          error: err instanceof Error ? err.message : "Invalid credentials or team code.",
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
    setRequests([]);
    setPool([]);
    setMessages([]);
    setDocuments([]);
    setNotifications([]);
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const updateMember = useCallback(async (patch: Partial<TeamMember>) => {
    let next: TeamMember | null = null;

    // First update the database if we are live
    if (liveRef.current && (patch.name || patch.email) && memberRef.current) {
      const { error } = await supabase
        .from("profiles")
        .update({ ...(patch.name ? { full_name: patch.name } : {}) })
        .eq("id", memberRef.current.id);

      if (error) {
        throw new Error(error.message);
      }
    }

    setMember((m) => {
      if (!m) return m;
      next = { ...m, ...patch };
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

    return next;
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

  const visibleDocuments = useMemo(() => documents, [documents]);
  const visibleMessages = useMemo(() => messages, [messages]);

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

  const assignToMe = useCallback(
    async (requestId: string) => {
      if (!member?.id) return;
      try {
        if (!liveRef.current) {
          // Demo / offline mode: update local store optimistically
          setRequests((prev) =>
            prev.map((r) =>
              r.id === requestId
                ? { ...r, assigneeId: member.id, status: "pending", lastUpdated: `Today • ${nowTime()}` }
                : r,
            ),
          );
          toast.success("Request claimed successfully!");
          return;
        }

        // Live backend: requestId is the UI reference (FRM-XXXXX) or raw UUID.
        let dbUuid = rooms.current[requestId]?.requestId;
        if (!dbUuid) {
          const { data: rows } = await supabase
            .from("requests")
            .select("id")
            .eq("reference", requestId)
            .maybeSingle();
          dbUuid = rows?.id ?? requestId;
        }

        const { error } = await supabase.rpc("claim_request", { req_id: dbUuid });
        if (error) {
          const msg =
            typeof (error as { message?: string }).message === "string"
              ? (error as { message?: string }).message!
              : JSON.stringify(error);
          throw new Error(msg);
        }

        // Optimistically update request in state
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? { ...r, assigneeId: member.id, status: "pending", lastUpdated: `Today • ${nowTime()}` }
              : r,
          ),
        );

        // Ensure the chat room is mapped in rooms.current
        if (!rooms.current[requestId]?.chatRoomId) {
          try {
            const freshRoom = await requestsApi.getOrCreateChatRoom(dbUuid);
            rooms.current[requestId] = { requestId: dbUuid, chatRoomId: freshRoom.id };
            setRoomsTick((t) => t + 1);
          } catch {
            // Non-fatal — realtime subscription will still attach
          }
        }

        fetchAnalytics();
        toast.success("Request claimed successfully!");
      } catch (err) {
        console.error("Failed to self-assign:", err);
        const msg =
          err instanceof Error
            ? err.message
            : typeof (err as { message?: string })?.message === "string"
              ? (err as { message?: string }).message!
              : JSON.stringify(err);
        toast.error("Failed to claim request: " + msg);
        throw err;
      }
    },
    [member, fetchAnalytics],
  );

  const transferChat = useCallback(
    async (requestId: string, targetAssigneeId: string) => {
      if (!member?.id) return;
      try {
        let dbUuid = rooms.current[requestId]?.requestId;
        if (!dbUuid) {
          const { data: rows } = await supabase
            .from("requests")
            .select("id")
            .eq("reference", requestId)
            .maybeSingle();
          dbUuid = rows?.id ?? requestId;
        }

        const { transferRequest } = await import("@/lib/api/requests");
        await transferRequest(dbUuid, targetAssigneeId);

        // Optimistically remove it from active UI
        setRequests((prev) => prev.filter((r) => r.id !== requestId));

        fetchAnalytics(); // Update stats
      } catch (err) {
        console.error("Failed to transfer chat:", err);
        throw err;
      }
    },
    [member, fetchAnalytics],
  );

  const escalateChat = useCallback(
    async (requestId: string) => {
      if (!member?.id) return;
      try {
        let dbUuid = rooms.current[requestId]?.requestId;
        if (!dbUuid) {
          const { data: rows } = await supabase
            .from("requests")
            .select("id")
            .eq("reference", requestId)
            .maybeSingle();
          dbUuid = rows?.id ?? requestId;
        }

        await requestsApi.escalateRequest(dbUuid);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, isEscalated: true } : r)),
        );
      } catch (err) {
        console.error("Failed to escalate chat:", err);
        throw err;
      }
    },
    [member],
  );

  const openAdminChat = useCallback(async (): Promise<string | null> => {
    const currentMember = memberRef.current;
    if (!currentMember) return null;

    if (liveRef.current) {
      const { request, room } = await getOrCreateAdminTeamChat(
        currentMember.id,
        currentMember.name,
      );
      const reqRef = request.reference || request.id;

      rooms.current[reqRef] = { requestId: request.id, chatRoomId: room.id };
      rooms.current[request.id] = { requestId: request.id, chatRoomId: room.id };
      refByRequestId.current[request.id] = reqRef;

      // Ensure room messages are loaded & subscribed in realtime
      if (room.id) {
        try {
          const { messages: fetchedMsgs } = await messagesApi.listRoomMessages(room.id);
          if (fetchedMsgs && fetchedMsgs.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newMsgs = fetchedMsgs
                .filter((m) => !existingIds.has(m.id))
                .map((m) => mapTeamMessage(m, reqRef, currentMember.name));
              return [...prev, ...newMsgs];
            });
          }
        } catch {
          // Ignore
        }
      }

      // Map and ensure request is in state
      const mapped = {
        ...mapTeamRequest(request, currentMember.id, "Admin Support"),
        assigneeId: currentMember.id,
      };
      setRequests((prev) => {
        const existingIdx = prev.findIndex(
          (r) => r.id === reqRef || r.id === request.id || r.id === request.reference,
        );
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = { ...next[existingIdx], ...mapped };
          return next;
        }
        return [mapped, ...prev];
      });

      return reqRef;
    } else {
      const mockRef = "ADM-TM-DIRECT";
      setRequests((prev) => {
        if (prev.some((r) => r.id === mockRef)) return prev;
        const mockReq: TeamRequest = {
          id: mockRef,
          title: "Direct Chat · Admin Support",
          category: "Team Direct Report",
          userName: "Admin Support",
          userInitials: "AD",
          status: "under-review",
          priority: "high",
          createdOn: "Today",
          assignedAt: "Just now",
          lastUpdated: "Just now",
          lastMessage: "Direct Admin Support Channel",
          unread: 0,
          progress: 100,
          assigneeId: currentMember.id,
          timeline: [{ label: "Chat started", time: "Just now" }],
        };
        return [mockReq, ...prev];
      });
      return mockRef;
    }
  }, []);

  const sendMessage = useCallback(
    async (requestId: string, text: string) => {
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

      const r = requestsRef.current.find((req) => req.id === requestId);
      if (r && !r.assigneeId) {
        try {
          await assignToMe(requestId);
        } catch (err) {
          console.error("Auto-assignment failed:", err);
        }
      }

      void sendMessageApi(id, requestId, text);
    },
    [member, assignToMe, sendMessageApi, touch],
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
      const messageId = uid("msg");
      setDocuments((prev) => [
        ...prev,
        {
          id,
          requestId,
          name: file.name,
          size: file.size,
          kind: file.kind,
          uploadedAt: nowTime(),
          uploadedBy: memberRef.current?.name ?? "Support",
          previewUrl: file.previewUrl,
        },
      ]);
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          requestId,
          author: "team",
          authorName: member?.name ?? "Support",
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
        const r = requestsRef.current.find((req) => req.id === requestId);
        if (r && !r.assigneeId) {
          try {
            await assignToMe(requestId);
          } catch (err) {
            console.error("Auto-assignment failed:", err);
          }
        }

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
    },
    [member, assignToMe, touch],
  );

  const deleteDocument = useCallback(async (documentId: string, storagePath?: string) => {
    try {
      if (storagePath) {
        await documentsApi.deleteDocument(documentId, storagePath);
      }
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      setMessages((prev) =>
        prev.map((m) => (m.documentId === documentId ? { ...m, documentId: undefined } : m)),
      );
      toast.success("Document deleted");
    } catch (err: any) {
      console.error("Delete document error:", err);
      // Still remove from local state if already deleted remotely
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      toast.error(err?.message || "Failed to delete document");
    }
  }, []);

  const setStatus = useCallback(
    (requestId: string, status: TeamStatus) => {
      const label =
        status === "completed"
          ? "Marked completed"
          : `Status updated to ${status.replace("-", " ")}`;

      const doUpdate = async (dbUuid: string) => {
        try {
          await requestsApi.updateRequestStatus(
            dbUuid,
            TEAM_TO_DB_STATUS[status],
            status === "completed" ? 100 : undefined,
          );
          fetchAnalytics();
        } catch (err) {
          console.error("Failed to update request status:", err);
          toast.error(
            "Status save failed: " +
              (err instanceof Error ? err.message : "Please try again."),
          );
          // Revert optimistic local update on failure
          touch(requestId, { status: status === "completed" ? "pending" : status }, undefined);
        }
      };

      if (liveRef.current) {
        const room = rooms.current[requestId];
        if (room) {
          void doUpdate(room.requestId);
        } else {
          // Fallback: look up DB UUID by reference column (handles paginated/lazy requests)
          void supabase
            .from("requests")
            .select("id")
            .eq("reference", requestId)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.id) {
                rooms.current[requestId] = { requestId: data.id, chatRoomId: null };
                void doUpdate(data.id);
              } else {
                toast.error("Could not find request. Please refresh and try again.");
              }
            });
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
    [touch, fetchAnalytics],
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
          const isUserMsg = row.sender_role === "user";
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, mapTeamMessage(row, reference, member.name)];
          });
          // Push a bell notification for every new user message so the team
          // member is alerted even when viewing another tab.
          if (isUserMsg) {
            const isChatOpen = window.location.pathname.includes("/team/work") && new URLSearchParams(window.location.search).get("id") === reference;
            if (!isChatOpen) {
              const preview = row.body?.slice(0, 80) || "Attachment";
              setNotifications((prev) => [
                {
                  id: `msg-notif-${row.id}`,
                  type: "message" as const,
                  text: `New message: ${preview}`,
                  time: nowTime(),
                  read: false,
                  requestId: reference,
                },
                ...prev.filter((n) => n.id !== `msg-notif-${row.id}`),
              ]);
              // Browser push notification (if permission granted)
              if (
                typeof Notification !== "undefined" &&
                Notification.permission === "granted"
              ) {
                new Notification("New message", {
                  body: preview,
                  tag: `msg-${reference}`,
                });
              }
            }
          }
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
          // Bell notification for new document too
          const isUserDoc = row.uploader_role === "user";
          if (isUserDoc) {
            setNotifications((prev) => [
              {
                id: `doc-notif-${row.id}`,
                type: "document" as const,
                text: `Document uploaded: ${row.file_name}`,
                time: nowTime(),
                read: false,
                requestId: reference,
              },
              ...prev.filter((n) => n.id !== `doc-notif-${row.id}`),
            ]);
          }
        },
        onTyping: (payload) => {
          if (payload.typing) startTyping(reference, 2500);
        },
      }),
    );
    const offRequests = subscribeToRequests((row) => {
      setRequests((prev) => {
        // If it's assigned to someone else (not null and not this member), remove it from the pool.
        if (row.assigned_team_id !== null && row.assigned_team_id !== member.id) {
          return prev.filter((r) => r.id !== (row.reference || row.id));
        }

        const mapped = mapTeamRequest(
          row,
          member.id,
          prev.find((r) => r.id === (row.reference || row.id))?.userName ?? "User",
        );
        const exists = prev.some((r) => r.id === mapped.id);
        const next = exists
          ? prev.map((r) =>
              r.id === mapped.id ? { ...mapped, unread: r.unread, timeline: r.timeline } : r,
            )
          : [{ ...mapped }, ...prev];
        return next.length > 500 ? next.slice(0, 500) : next;
      });
    });
    return () => {
      offs.forEach((off) => off());
      offRequests();
    };
  }, [live, member, requests.length, startTyping, roomsTick]);

  // Live notification centre: new rows stream straight into the bell.
  useEffect(() => {
    if (!live || !member) return;
    return subscribeToMyNotifications(member.id, (row) => {
      setNotifications((prev) =>
        prev.some((n) => n.id === row.id)
          ? prev
          : [mapTeamNotification(row, refByRequestId.current), ...prev],
      );

      if (row.type === "message") {
        const isChatOpen = isChatActive({
          requestId: row.request_id,
          chatRoomId: row.chat_room_id,
          route: row.route,
        });
        if (!isChatOpen) {
          playMessageNotificationSound();
          showSystemNotification(row.title || "New message", row.body || "New message received", {
            data: {
              requestId: row.request_id || "",
              chatRoomId: row.chat_room_id || "",
            },
            onClick: () => {
              if (row.request_id) {
                window.location.href = `/team/work?id=${row.request_id}`;
              }
            },
          });

          toast(row.title || "New message", {
            description: row.body || "New message received",
            duration: 6000,
            action: row.request_id
              ? {
                  label: "Open chat",
                  onClick: () => {
                    window.location.href = `/team/work?id=${row.request_id}`;
                  },
                }
              : undefined,
          });
        }
      }
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

  const updateTags = useCallback((requestId: string, tags: string[]) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId || r.id.toLowerCase() === requestId.toLowerCase()
          ? { ...r, tags }
          : r,
      ),
    );
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
      signInWithTeamAuth,
      signOut,
      updateMember,
      analytics,
      fetchAnalytics,
      requestsHasMore,
      requestsLoadingMore,
      requestsPage,
      loadMoreRequests,
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
      deleteDocument,
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
      updateTags,
      unreadNotifications,
      assignToMe,
      transferChat,
      escalateChat,
      openAdminChat,
      pool,
      loading,
    }),
    [
      member,
      hydrated,
      loading,
      live,
      signIn,
      signInWithTeamAuth,
      signOut,
      updateMember,
      requestsHasMore,
      requestsLoadingMore,
      requestsPage,
      loadMoreRequests,
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
      deleteDocument,
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
      updateTags,
      unreadNotifications,
      assignToMe,
      transferChat,
      escalateChat,
      openAdminChat,
      pool,
      analytics,
      fetchAnalytics,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTeamStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTeamStore must be used inside TeamStoreProvider");
  return ctx;
}
