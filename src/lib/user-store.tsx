import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ACTIVE_STATUSES,
  SEED_DOCUMENTS,
  SEED_MESSAGES,
  SEED_NOTIFICATIONS,
  NEWS_ITEMS,
  SEED_REQUESTS,
  USER_PROFILE,
  type AppNotification,
  type ChatMessage,
  type SupportRequest,
  type UserDocument,
} from "@/data/user-module";
import { UserStoreContext, type Profile, type UserStore as Store } from "@/lib/user-store-context";

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Collision-proof id: Date.now() alone repeats when two records are made in the same ms. */
let idSeq = 0;
function uid(prefix: string) {
  idSeq += 1;
  return `${prefix}-${Date.now()}-${idSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

function nextRequestId(existing: SupportRequest[]) {
  const max = existing.reduce((acc, r) => {
    const n = Number(r.id.split("-").pop());
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 1000);
  return `FBH-2026-${max + 1}`;
}

export function DemoUserStoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>({ ...USER_PROFILE, id: "DEMO-USR-001" });
  const [requests, setRequests] = useState<SupportRequest[]>(SEED_REQUESTS);
  const [messages, setMessages] = useState<ChatMessage[]>(SEED_MESSAGES);
  const [documents, setDocuments] = useState<UserDocument[]>(SEED_DOCUMENTS);
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Every simulated-delivery timer is tracked so unmount can't leave stray updates behind.
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, delay);
    timers.current.push(id);
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch })),
    [],
  );

  const activeRequest = useMemo(
    () => requests.find((r) => ACTIVE_STATUSES.includes(r.status)) ?? null,
    [requests],
  );

  const getRequest = useCallback((id: string) => requests.find((r) => r.id === id), [requests]);
  const messagesFor = useCallback(
    (id: string) => messages.filter((m) => m.requestId === id),
    [messages],
  );
  const documentsFor = useCallback(
    (id: string) => documents.filter((d) => d.requestId === id),
    [documents],
  );

  const createRequest = useCallback(
    (title: string, category?: string) => {
      const created: SupportRequest = {
        id: nextRequestId(requests),
        title,
        status: "new",
        createdAt: new Date().toLocaleDateString([], {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        assignedTo: "Support Team",
        assigneeOnline: true,
        lastUpdate: nowTime(),
        lastMessage: "Request created. A support member will connect with you shortly.",
        unread: 0,
        progress: 10,
        notes: [],
        activity: [{ label: "Request Created", time: nowTime() }],
      };
      setRequests((prev) => [created, ...prev]);
      setMessages((prev) => [
        ...prev,
        {
          id: uid("m"),
          requestId: created.id,
          author: "support",
          authorName: "Support Team",
          time: nowTime(),
          text: "Hello! Your request has been created. How can we assist you today?",
        },
      ]);
      return created;
    },
    [requests],
  );

  const touchRequest = useCallback((requestId: string, lastMessage: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, lastMessage, lastUpdate: nowTime() } : r)),
    );
  }, []);

  const sendMessage = useCallback(
    (requestId: string, text: string) => {
      const id = uid("m");
      setMessages((prev) => [
        ...prev,
        {
          id,
          requestId,
          author: "user",
          authorName: "You",
          time: nowTime(),
          text,
          state: "sending",
        },
      ]);
      touchRequest(requestId, text);
      later(() => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: "sent" } : m)));
      }, 600);
    },
    [touchRequest, later],
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, state: "sending" } : m)));
      later(() => {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, state: "sent" } : m)));
      }, 600);
    },
    [later],
  );

  const attachFile = useCallback(
    (
      requestId: string,
      name: string,
      kind: UserDocument["kind"],
      size: string,
      preview?: { previewUrl?: string; pageCount?: number; dimensions?: string },
    ) => {
      const request = requests.find((r) => r.id === requestId);
      const docId = uid("d");
      const msgId = uid("m");

      setDocuments((prev) => [
        {
          id: docId,
          name,
          kind,
          size,
          requestId,
          requestTitle: request?.title ?? "Support Request",
          uploadedBy: "You",
          date: new Date().toLocaleDateString([], {
            day: "2-digit",
            month: "long",
            year: "numeric",
          }),
          ...preview,
        },
        ...prev,
      ]);
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          requestId,
          author: "user",
          authorName: "You",
          time: nowTime(),
          file: { id: docId, name, kind, size, ...preview },
          state: "sent",
        },
      ]);
      touchRequest(requestId, `Shared ${name}`);
    },
    [requests, touchRequest],
  );

  const uploadPersonalDocument = useCallback(async (file: File, name: string) => {
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : file.type === "image/png"
        ? ".png"
        : ".jpg";
    let finalName = name.trim() || file.name;
    if (!finalName.toLowerCase().endsWith(ext.toLowerCase())) {
      finalName = `${finalName}${ext}`;
    }
    setDocuments((prev) => [
      {
        id: uid("d"),
        name: finalName,
        kind: file.type.startsWith("image/") ? "image" : "doc",
        size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        requestId: "",
        requestTitle: "Personal Document",
        uploadedBy: "You",
        date: new Date().toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" }),
        previewUrl: URL.createObjectURL(file),
      },
      ...prev,
    ]);
  }, []);

  const uploadAvatar = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file);
      updateProfile({ avatarUrl: url });
    },
    [updateProfile],
  );

  const removeFile = useCallback(async (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addNote = useCallback((requestId: string, note: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, notes: [...r.notes, note] } : r)),
    );
  }, []);

  const markRead = useCallback((requestId: string) => {
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, unread: 0 } : r)));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const value = useMemo<Store>(
    () => ({
      profile,
      updateProfile,
      requests,
      messages,
      documents,
      notifications,
      news: NEWS_ITEMS,
      activeRequest,
      getRequest,
      messagesFor,
      documentsFor,
      createRequest,
      refresh: async () => {},
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
      live: false,
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
      sidebarOpen,
    ],
  );

  return <UserStoreContext.Provider value={value}>{children}</UserStoreContext.Provider>;
}

export function useUserStore() {
  const ctx = useContext(UserStoreContext);
  if (!ctx) throw new Error("useUserStore must be used inside UserStoreProvider");
  return ctx;
}
