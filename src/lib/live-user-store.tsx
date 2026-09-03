import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as requestsApi from "@/lib/api/requests";
import * as messagesApi from "@/lib/api/messages";
import * as documentsApi from "@/lib/api/documents";
import * as notificationsApi from "@/lib/api/notifications";
import * as realtimeApi from "@/lib/api/realtime";
import * as authApi from "@/lib/api/auth";
import type {
  DbRequestStatus,
  DocumentRow,
  MessageRow,
  NotificationRow,
  RequestRow,
} from "@/lib/api/types";
import { UserStoreContext, type Profile, type UserStore } from "@/lib/user-store-context";
import type {
  AppNotification,
  NewsItem,
  ChatMessage,
  FileKind,
  RequestStatus,
  SupportRequest,
  UserDocument,
} from "@/data/user-module";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import { playMessageNotificationSound } from "@/lib/audio-notifications";
import { showSystemNotification } from "@/lib/fcm";
import { isChatActive, getActiveChat, onActiveChatChange } from "@/lib/active-chat-tracker";
import { supabase } from "@/integrations/supabase/client";

const STATUS_MAP: Record<DbRequestStatus, RequestStatus> = {
  pending: "pending",
  assigned: "assigned",
  waiting_documents: "waiting-documents",
  under_review: "under-review",
  in_progress: "in-progress",
  completed: "completed",
  cancelled: "completed",
  closed: "completed",
};

function time(iso?: string | null) {
  return new Date(iso ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function day(iso?: string | null) {
  return new Date(iso ?? Date.now()).toLocaleDateString([], {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
function sizeLabel(bytes?: number | null) {
  const b = bytes ?? 0;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}
function fileKind(kind?: string | null): FileKind {
  return kind === "image" || kind === "pdf" ? kind : "doc";
}
function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

let seq = 0;
function uid(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export function LiveUserStoreProvider({ children }: { children: ReactNode }) {
  const { user, profile: dbProfile, refresh } = useSession();

  const cacheKey = user ? `formbhro:user_requests:${user.id}` : null;
  const getInitialRequests = (): SupportRequest[] => {
    if (typeof window === "undefined" || !cacheKey) return [];
    try {
      const raw = sessionStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const [requests, setRequests] = useState<SupportRequest[]>(getInitialRequests);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(() => getInitialRequests().length === 0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** bumped whenever the room map changes so realtime subscriptions re-attach. */
  const [roomsVersion, setRoomsVersion] = useState(0);
  /** reference -> peer (team member) currently typing. */
  const [typingIn, setTypingIn] = useState<Record<string, boolean>>({});
  const typingToken = useRef<Record<string, number>>({});
  const lastTypingSent = useRef<Record<string, number>>({});

  /** reference (UI id) -> { requestId, chatRoomId } */
  const rooms = useRef<
    Record<string, { requestId: string; chatRoomId: string | null; title: string }>
  >({});
  /** request uuid -> UI reference, so notifications can deep-link into the right chat. */
  const referenceById = useRef<Record<string, string>>({});
  /** assigned team member uuid -> display name. */
  const teamNames = useRef<Record<string, string>>({});
  /** Set of room IDs that have already loaded their messages */
  const loadedRoomsRef = useRef<Set<string>>(new Set());
  /** The single chat room currently active/focused on screen */
  const [activeChatRoom, setActiveChatRoom] = useState<{
    chatRoomId: string;
    reference: string;
  } | null>(null);

  const profile = useMemo<Profile>(() => {
    const name = dbProfile?.full_name ?? user?.user_metadata?.full_name ?? user?.email ?? "You";
    return {
      id: user?.id ?? "USR-001",
      name,
      full_name: name,
      initials: initialsOf(name) || "U",
      email: dbProfile?.email ?? user?.email ?? "",
      phone: dbProfile?.phone ?? "",
      createdAt: day(dbProfile?.created_at ?? user?.created_at),
      authProvider: (dbProfile?.auth_provider === "password" ? "password" : "google") as
        "google" | "password",
      avatarUrl: dbProfile?.avatar_url ?? undefined,
    };
  }, [dbProfile, user]);

  const mapRequest = useCallback((row: RequestRow): SupportRequest => {
    return {
      id: row.reference || row.id,
      reference: row.reference || row.id,
      title: row.title,
      status: STATUS_MAP[row.status] ?? "pending",
      createdAt: day(row.created_at),
      assignedTo: row.assigned_team_id
        ? (teamNames.current[row.assigned_team_id] ?? "Support Team")
        : "Awaiting assignment",
      assigneeOnline: Boolean(row.assigned_team_id),
      lastUpdate: time(row.last_activity_at ?? row.created_at),
      lastMessage:
        row.last_message ?? "Request created. A support member will connect with you shortly.",
      unread: 0,
      progress: row.progress ?? 0,
      notes: [],
      activity: [{ label: "Request Created", time: time(row.created_at) }],
    };
  }, []);

  const mapMessage = useCallback(
    (row: MessageRow & { attachment?: DocumentRow | null }, reference: string): ChatMessage => ({
      id: row.id,
      requestId: reference,
      senderId: row.sender_id ?? undefined,
      author: row.sender_role === "user" ? "user" : "support",
      authorName:
        row.sender_role === "user"
          ? "You"
          : row.sender_role === "system"
            ? "Formbhro"
            : "Support Team",
      time: time(row.created_at),
      text: row.body ?? undefined,
      isSystem: row.is_system,
      callLog: (row.reactions as any)?.call_log ?? undefined,
      state: row.seen ? "read" : "delivered",
      file: row.attachment
        ? {
            id: row.attachment.id,
            name: row.attachment.file_name,
            kind: fileKind(row.attachment.kind),
            size: sizeLabel(row.attachment.size_bytes),
            storagePath: row.attachment.storage_path ?? undefined,
          }
        : row.attachment_id
          ? {
              id: row.attachment_id,
              name: "Document",
              kind: "doc",
              size: "",
            }
          : undefined,
    }),
    [],
  );

  const mapDocument = useCallback(
    (row: DocumentRow, reference: string, requestTitle: string): UserDocument => ({
      id: row.id,
      name: row.file_name,
      kind: fileKind(row.kind),
      size: sizeLabel(row.size_bytes),
      date: day(row.created_at),
      uploadedBy: row.uploader_role === "user" ? "You" : "Support Team",
      requestId: reference,
      requestTitle,
      storagePath: row.storage_path ?? undefined,
    }),
    [],
  );

  const mapNotification = useCallback((row: NotificationRow): AppNotification => {
    const isAnnouncement = row.type === "announcement" || row.type === "admin";
    const allowed = [
      "assigned",
      "message",
      "document",
      "status",
      "completed",
      "announcement",
    ] as const;
    const type = (allowed as readonly string[]).includes(row.type)
      ? (row.type as AppNotification["type"])
      : "message";
    return {
      id: row.id,
      type,
      text: row.title || row.body || "Update",
      time: time(row.created_at),
      read: Boolean(row.is_read),
      requestId: row.request_id ? referenceById.current[row.request_id] : undefined,
      to: isAnnouncement ? "news" : "chat",
    };
  }, []);

  const prevUserIdRef = useRef<string | null>(user?.id ?? null);
  useEffect(() => {
    if (prevUserIdRef.current !== (user?.id ?? null)) {
      prevUserIdRef.current = user?.id ?? null;
      setRequests(getInitialRequests());
      setMessages([]);
      setDocuments([]);
      setNotifications([]);
      setNews([]);
      rooms.current = {};
      referenceById.current = {};
      loadedRoomsRef.current.clear();
      teamNames.current = {};
      setActiveChatRoom(null);
    }
  }, [user?.id]);

  const isInitialHydrate = useRef(true);

  const hydrate = useCallback(
    async (showLoading = false) => {
      if (!user) return;
      const t0 = Date.now();
      console.log(`[PERF][STORE] T5: User store hydration started for user=${user.id}`);
      if (
        showLoading &&
        isInitialHydrate.current &&
        !sessionStorage.getItem(`formbhro:user_requests:${user.id}`)
      ) {
        setLoading(true);
      }
      try {
        const [rows, notes, newsRows, docRows] = await Promise.all([
          requestsApi.listRequests({ limit: 20 }),
          notificationsApi.listNotifications(30),
          notificationsApi.listNews(),
          documentsApi.listDocuments({ limit: 100 }),
        ]);

        console.log(
          `[PERF][HYDRATION] T6: User store primary queries resolved in ${Date.now() - t0}ms`,
        );

        referenceById.current = Object.fromEntries(rows.map((r) => [r.id, r.reference || r.id]));
        const mappedRequests = rows.map(mapRequest);
        setRequests(mappedRequests);
        if (cacheKey) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(mappedRequests));
          } catch {}
        }

        const requestMap = Object.fromEntries(rows.map((r) => [r.id, r]));
        const allDocuments: UserDocument[] = docRows.map((doc) => {
          const req = doc.request_id ? requestMap[doc.request_id] : undefined;
          const ref = req ? req.reference || req.id : "";
          const title = req ? req.title : "Personal Document";
          return mapDocument(doc, ref, title);
        });
        setDocuments(allDocuments);

        setNotifications(notes.map(mapNotification));
        setNews(
          newsRows.map((n) => ({
            id: n.id,
            title: n.title,
            description: n.description,
            date: day(n.published_at),
            category: n.category,
            featured: n.featured,
            image_url: n.image_url,
          })),
        );

        // INSTANT UNBLOCK: Unblock UI immediately after primary resources load
        setLoading(false);
        isInitialHydrate.current = false;
        console.log(`[PERF][READY] T10: User store ready in ${Date.now() - t0}ms`);

        // 1. Batch-fetch chat_rooms for ALL rows in a single query (1 call instead of 20)
        const rowIds = rows.map((r) => r.id);
        const { data: allRooms } = rowIds.length
          ? await supabase.from("chat_rooms").select("id, request_id").in("request_id", rowIds)
          : { data: [] };

        const roomByRequestId = new Map((allRooms ?? []).map((rm) => [rm.request_id, rm]));
        const nextRooms: typeof rooms.current = {};
        for (const row of rows) {
          const reference = row.reference || row.id;
          const rm = roomByRequestId.get(row.id);
          nextRooms[reference] = {
            requestId: row.id,
            chatRoomId: rm?.id ?? null,
            title: row.title,
          };
          referenceById.current[row.id] = reference;
        }
        rooms.current = nextRooms;

        // 2. Fetch messages ONLY for the active / latest request needed by dashboard
        const activeRow = rows.find((r) => r.status !== "completed") ?? rows[0];
        if (activeRow) {
          const activeRoom = roomByRequestId.get(activeRow.id);
          if (activeRoom) {
            loadedRoomsRef.current.add(activeRoom.id);
            const msgs = await messagesApi.listMessages(activeRoom.id, { limit: 50 });
            const ref = activeRow.reference || activeRow.id;
            setMessages(msgs.map((m) => mapMessage(m, ref)));
          }
        }

        // 3. Background: Fetch team names if any
        const uniqueTeamIds = Array.from(
          new Set(rows.map((r) => r.assigned_team_id).filter((id): id is string => Boolean(id))),
        );
        if (uniqueTeamIds.length > 0) {
          void authApi.getProfilesByIds(uniqueTeamIds).then((profilesById) => {
            teamNames.current = Object.fromEntries(
              Object.entries(profilesById).map(([id, p]) => [id, p.full_name || "Support Team"]),
            );
            setRequests(rows.map(mapRequest));
          });
        }
      } catch (err) {
        console.error("[LiveUserStore] Hydration failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [user, mapRequest, mapMessage, mapDocument, mapNotification],
  );

  /**
   * On-demand chat message loader for active chat views.
   * Replaces the historical startup storm.
   */
  const loadChat = useCallback(
    async (reqIdOrRef: string) => {
      if (!reqIdOrRef) return;
      const clean = reqIdOrRef.trim().toLowerCase();
      let matchedRef = reqIdOrRef;
      for (const [ref, r] of Object.entries(rooms.current)) {
        if (
          ref.toLowerCase() === clean ||
          r.requestId.toLowerCase() === clean ||
          referenceById.current[reqIdOrRef] === ref
        ) {
          matchedRef = ref;
          break;
        }
      }

      let room = rooms.current[matchedRef];
      if (!room?.chatRoomId) {
        const rawRoom = await requestsApi.getChatRoom(room?.requestId || matchedRef);
        if (rawRoom) {
          room = {
            requestId: rawRoom.request_id,
            chatRoomId: rawRoom.id,
            title: room?.title || "Support Chat",
          };
          rooms.current[matchedRef] = room;
          referenceById.current[rawRoom.request_id] = matchedRef;
        }
      }

      if (room?.chatRoomId && !loadedRoomsRef.current.has(room.chatRoomId)) {
        loadedRoomsRef.current.add(room.chatRoomId);
        loadedRoomsRef.current.add(matchedRef.toLowerCase());
        loadedRoomsRef.current.add(room.requestId.toLowerCase());
        const msgs = await messagesApi.listMessages(room.chatRoomId, { limit: 50 });
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = msgs
            .filter((m) => !existingIds.has(m.id))
            .map((m) => mapMessage(m, matchedRef));
          return [...prev, ...newMsgs];
        });
      }
    },
    [mapMessage],
  );

  useEffect(() => {
    void hydrate(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void hydrate(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hydrate]);

  // Track active chat room for exclusive on-demand WebSocket subscription
  useEffect(() => {
    const resolveActive = () => {
      const cur = getActiveChat();
      if (!cur.chatRoomId && !cur.requestId) {
        setActiveChatRoom(null);
        return;
      }
      const ref =
        cur.requestRef || referenceById.current[cur.requestId || ""] || cur.requestId || "";
      const room = rooms.current[ref];
      const roomId = cur.chatRoomId || room?.chatRoomId;
      if (roomId) {
        setActiveChatRoom({ chatRoomId: roomId, reference: ref });
      } else {
        setActiveChatRoom(null);
      }
    };

    resolveActive();
    return onActiveChatChange(resolveActive);
  }, []);

  // Exclusively subscribe to the active chat room in Realtime (1 socket instead of 20)
  useEffect(() => {
    if (!user || !activeChatRoom?.chatRoomId) return;
    const { chatRoomId, reference } = activeChatRoom;
    console.log(
      `[PERF][REALTIME] Subscribing on-demand to active room=${chatRoomId} (${reference})`,
    );

    // Ensure messages are loaded for the active chat
    void loadChat(reference);

    return realtimeApi.subscribeToRoom(chatRoomId, {
      onMessage: (row) => {
        setMessages((prev) =>
          prev.some((m) => m.id === row.id) ? prev : [...prev, mapMessage(row, reference)],
        );
      },
      onMessageUpdate: (row) => {
        setMessages((prev) => prev.map((m) => (m.id === row.id ? mapMessage(row, reference) : m)));
      },
      onDocument: (row) => {
        setDocuments((prev) =>
          prev.some((d) => d.id === row.id)
            ? prev
            : [mapDocument(row, reference, rooms.current[reference]?.title || "Document"), ...prev],
        );
      },
      onTyping: (p) => {
        if (!p?.typing || p.userId === user.id) return;
        const token = (typingToken.current[reference] ?? 0) + 1;
        typingToken.current[reference] = token;
        setTypingIn((t) => ({ ...t, [reference]: true }));
        setTimeout(() => {
          if (typingToken.current[reference] !== token) return;
          setTypingIn((t) => ({ ...t, [reference]: false }));
        }, 2500);
      },
    });
  }, [user, activeChatRoom, mapMessage, mapDocument, loadChat]);

  // Request status / progress changes pushed from the team panel.
  useEffect(() => {
    if (!user) return;
    return realtimeApi.subscribeToRequests((row) => {
      setRequests((prev) => {
        const mapped = mapRequest(row);
        const exists = prev.some((r) => r.id === mapped.id);
        return exists
          ? prev.map((r) => (r.id === mapped.id ? { ...mapped, notes: r.notes } : r))
          : [mapped, ...prev];
      });
    });
  }, [user, mapRequest]);

  const activeRequest = useMemo(
    () => requests.find((r) => r.status !== "completed") ?? null,
    [requests],
  );

  const getRequest = useCallback(
    (id: string) => {
      if (!id) return undefined;
      const cleanId = id.trim().toLowerCase();
      return requests.find(
        (r) =>
          r.id?.toLowerCase() === cleanId ||
          r.reference?.toLowerCase() === cleanId ||
          (referenceById.current[id] &&
            (r.id === referenceById.current[id] || r.reference === referenceById.current[id])),
      );
    },
    [requests],
  );

  const messagesFor = useCallback(
    (id: string) => {
      if (!id) return [];
      const cleanId = id.trim().toLowerCase();
      const ref = (referenceById.current[id] || id).trim().toLowerCase();
      // On-demand message loading when messages are accessed for a specific chat
      if (!loadedRoomsRef.current.has(cleanId) && !loadedRoomsRef.current.has(ref)) {
        void loadChat(ref);
      }
      return messages.filter(
        (m) => m.requestId?.toLowerCase() === cleanId || m.requestId?.toLowerCase() === ref,
      );
    },
    [messages, loadChat],
  );

  const documentsFor = useCallback(
    (id: string) => {
      if (!id) return [];
      const cleanId = id.trim().toLowerCase();
      const ref = (referenceById.current[id] || id).trim().toLowerCase();
      return documents.filter(
        (d) => d.requestId?.toLowerCase() === cleanId || d.requestId?.toLowerCase() === ref,
      );
    },
    [documents],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      try {
        await authApi.updateMyProfile({
          ...(patch.name ? { full_name: patch.name } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        });
        await refresh();
      } catch (err) {
        console.error("Profile update failed:", err);
        throw err;
      }
    },
    [refresh],
  );

  const createRequest = useCallback(
    async (title: string = "Form Assistance", category?: string) => {
      const request = await requestsApi.createNewRequest({ title, category: category || title });
      const reference = request.reference || request.id;
      const room = await requestsApi.getChatRoom(request.id);
      rooms.current[reference] = {
        requestId: request.id,
        chatRoomId: room?.id ?? null,
        title: request.title,
      };
      referenceById.current[request.id] = reference;
      setRoomsVersion((v) => v + 1);
      const mapped = mapRequest(request);
      setRequests((prev) => (prev.some((r) => r.id === mapped.id) ? prev : [mapped, ...prev]));
      if (room) {
        const list = await messagesApi.listMessages(room.id, { limit: 50 });
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          return [
            ...prev,
            ...list.filter((m) => !known.has(m.id)).map((m) => mapMessage(m, reference)),
          ];
        });
      }
      return mapped;
    },
    [mapRequest, mapMessage],
  );

  const sendMessage = useCallback((reference: string, text: string) => {
    const room = rooms.current[reference];
    if (!room?.chatRoomId) return;
    const tempId = uid("m");
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        requestId: reference,
        author: "user",
        authorName: "You",
        time: time(),
        text,
        state: "sending",
      },
    ]);
    setRequests((prev) =>
      prev.map((r) => (r.id === reference ? { ...r, lastMessage: text, lastUpdate: time() } : r)),
    );
    void messagesApi
      .sendMessageWithRetry(
        {
          chatRoomId: room.chatRoomId,
          requestId: room.requestId,
          body: text,
          senderRole: "user",
        },
        5,
      )
      .then((row) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev.filter((m) => m.id !== tempId);
          return prev.map((m) => (m.id === tempId ? { ...m, id: row.id, state: "delivered" } : m));
        });
      })
      .catch(() => {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, state: "failed" } : m)));
      });
  }, []);

  const retryMessage = useCallback(
    (messageId: string) => {
      const failed = messages.find((m) => m.id === messageId);
      if (!failed?.text) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      sendMessage(failed.requestId, failed.text);
    },
    [messages, sendMessage],
  );

  const attachFile = useCallback<UserStore["attachFile"]>(
    (reference, name, kind, size, preview, file) => {
      const room = rooms.current[reference];
      if (!room) return;
      if (!file) return; // Live mode uploads the real file only.
      void (async () => {
        try {
          const doc = await documentsApi.uploadDocument({
            file,
            requestId: room.requestId,
            chatRoomId: room.chatRoomId ?? undefined,
            uploaderRole: "user",
          });
          setDocuments((prev) =>
            prev.some((d) => d.id === doc.id)
              ? prev
              : [mapDocument(doc, reference, room.title), ...prev],
          );
          if (room.chatRoomId) {
            await messagesApi.sendMessageWithRetry({
              chatRoomId: room.chatRoomId,
              requestId: room.requestId,
              attachmentId: doc.id,
              senderRole: "user",
            });
          }
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              id: uid("m"),
              requestId: reference,
              author: "user",
              authorName: "You",
              time: time(),
              text: `Upload failed for ${name}. Please try again.`,
              state: "failed",
            },
          ]);
        }
      })();
    },
    [mapDocument],
  );

  const uploadPersonalDocument = useCallback(
    async (file: File, name: string) => {
      const ext = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf("."))
        : file.type === "image/png"
          ? ".png"
          : ".jpg";
      let finalName = name.trim() || file.name;
      if (!finalName.toLowerCase().endsWith(ext.toLowerCase())) {
        finalName = `${finalName}${ext}`;
      }

      // If the user has an active request, link the document to it so team
      // members can see it via their subscribeToRoom listener and document
      // list fetch (which filters by request_id). Without this, personal
      // documents (request_id = null, chat_room_id = null) are completely
      // invisible to the support team.
      const activeRef = Object.values(rooms.current).find((r) => r.chatRoomId !== null);
      const requestId = activeRef?.requestId ?? undefined;
      const chatRoomId = activeRef?.chatRoomId ?? undefined;

      const doc = await documentsApi.uploadDocument({
        file,
        fileName: finalName,
        uploaderRole: "user",
        requestId,
        chatRoomId,
      });

      // Derive the UI reference for display
      const reference = requestId
        ? (Object.entries(rooms.current).find(([, r]) => r.requestId === requestId)?.[0] ?? "")
        : "";
      const title = requestId
        ? (rooms.current[reference]?.title ?? "My Request")
        : "Personal Document";

      setDocuments((prev) =>
        prev.some((d) => d.id === doc.id) ? prev : [mapDocument(doc, reference, title), ...prev],
      );
    },
    [mapDocument],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      try {
        const publicUrl = await authApi.uploadAvatar(file);
        await authApi.updateMyProfile({ avatar_url: publicUrl });
        await hydrate();
      } catch (err) {
        console.error("Avatar upload failed:", err);
        throw err;
      }
    },
    [hydrate],
  );

  const removeFile = useCallback(async (id: string, storagePath?: string) => {
    if (!storagePath) {
      // In case we don't have the storage path (shouldn't happen for valid documents), just filter.
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      return;
    }

    // Optimistic UI update
    setDocuments((prev) => prev.filter((d) => d.id !== id));

    try {
      await documentsApi.deleteDocument(id, storagePath);
    } catch (err) {
      // Revert if API fails? For now just log or let the user know.
      // But typically we'd show a toast here.
      console.error("Failed to delete document", err);
    }
  }, []);

  const addNote = useCallback((reference: string, note: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === reference ? { ...r, notes: [...r.notes, note] } : r)),
    );
  }, []);

  const markRead = useCallback((reference: string) => {
    const room = rooms.current[reference];
    setRequests((prev) => prev.map((r) => (r.id === reference ? { ...r, unread: 0 } : r)));
    if (room?.chatRoomId)
      void messagesApi.markMessagesSeen(room.chatRoomId, "user").catch(() => undefined);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void notificationsApi.markNotificationRead(id).catch(() => undefined);
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void notificationsApi.markAllNotificationsRead().catch(() => undefined);
  }, []);

  // Notification fan-out from the backend triggers.
  useEffect(() => {
    if (!user) return;
    return realtimeApi.subscribeToMyNotifications(user.id, (row) => {
      setNotifications((prev) =>
        prev.some((n) => n.id === row.id) ? prev : [mapNotification(row), ...prev],
      );

      if (row.type === "message") {
        const isChatOpen = isChatActive({
          requestId: row.request_id,
          chatRoomId: row.chat_room_id,
        });
        if (!isChatOpen) {
          playMessageNotificationSound();
          showSystemNotification(row.title || "New message", row.body || "You have a new message", {
            data: {
              requestId: row.request_id || "",
              chatRoomId: row.chat_room_id || "",
            },
            onClick: () => {
              if (row.request_id) {
                window.location.href = `/app/chats/${row.request_id}`;
              }
            },
          });

          toast(row.title || "New message", {
            description: row.body || "You have a new message",
            duration: 6000,
            action: row.request_id
              ? {
                  label: "Open chat",
                  onClick: () => {
                    window.location.href = `/app/chats/${row.request_id}`;
                  },
                }
              : undefined,
          });
        }
      }
    });
  }, [user, mapNotification]);

  // Document fan-out for personal documents.
  useEffect(() => {
    if (!user) return;
    return realtimeApi.subscribeToMyDocuments(user.id, (row) => {
      setDocuments((prev) => {
        if (prev.some((d) => d.id === row.id)) return prev;
        const ref = row.request_id ? referenceById.current[row.request_id] || row.request_id : "";
        const title =
          row.request_id && rooms.current[ref] ? rooms.current[ref].title : "Personal Document";
        return [mapDocument(row, ref, title), ...prev];
      });
    });
  }, [user, mapDocument]);

  const isPeerTyping = useCallback((requestId: string) => Boolean(typingIn[requestId]), [typingIn]);

  const notifyTyping = useCallback(
    (requestId: string) => {
      const room = rooms.current[requestId];
      if (!room?.chatRoomId || !user) return;
      const now = Date.now();
      if (now - (lastTypingSent.current[requestId] ?? 0) < 1200) return;
      lastTypingSent.current[requestId] = now;
      void realtimeApi
        .sendTyping(room.chatRoomId, { userId: user.id, name: profile.name, typing: true })
        .catch(() => undefined);
    },
    [user, profile.name],
  );

  const value = useMemo<UserStore>(
    () => ({
      profile,
      updateProfile,
      requests,
      messages,
      documents,
      notifications,
      news,
      activeRequest,
      getRequest,
      messagesFor,
      documentsFor,
      createRequest,
      refresh: hydrate,
      sendMessage,
      retryMessage,
      attachFile,
      uploadPersonalDocument,
      uploadAvatar,
      removeFile,
      addNote,
      markRead,
      markNotificationRead,
      markAllNotificationsRead,
      rooms,
      isPeerTyping,
      notifyTyping,
      loadChat,
      live: true,
      loading,
      sidebarOpen,
      setSidebarOpen,
    }),
    [
      profile,
      updateProfile,
      requests,
      messages,
      documents,
      notifications,
      activeRequest,
      getRequest,
      messagesFor,
      documentsFor,
      createRequest,
      hydrate,
      sendMessage,
      retryMessage,
      attachFile,
      uploadPersonalDocument,
      uploadAvatar,
      removeFile,
      addNote,
      markRead,
      markNotificationRead,
      markAllNotificationsRead,
      news,
      loading,
      sidebarOpen,
      isPeerTyping,
      notifyTyping,
      loadChat,
    ],
  );

  return <UserStoreContext.Provider value={value}>{children}</UserStoreContext.Provider>;
}
