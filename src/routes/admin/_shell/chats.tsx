import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { canShareScreen, cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
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
  Download,
  Trash2,
  History,
  Copy,
  Check,
  RefreshCw,
  Search,
  User,
  X,
  ExternalLink,
  CheckCircle2,
  FileText,
  CreditCard,
  BadgeIndianRupee,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { PresenceDot } from "@/components/team/PresenceDot";
import { downloadCsv } from "@/lib/csv-export";
import { useAdmin } from "@/lib/admin-store";
import { Button, Panel, Pill, SearchBox, formatDate, inputClass } from "@/components/admin/AdminUI";
import * as messagesApi from "@/lib/api/messages";
import { subscribeToRoom } from "@/lib/api/realtime";
import { useChatScroll } from "@/lib/use-chat-scroll";
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
import { adminSearchUser } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/admin/_shell/chats")({
  component: AdminChats,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    request?: string;
    teamMember?: string;
    type?: "monitor" | "team";
    mode?: "threads" | "user-search" | "chat-search";
    f?: "all" | "escalated" | "waiting_documents" | "pending" | "completed";
    userId?: string;
    chatId?: string;
    q?: string;
  } => ({
    request: typeof search["request"] === "string" ? (search["request"] as string) : undefined,
    teamMember:
      typeof search["teamMember"] === "string" ? (search["teamMember"] as string) : undefined,
    type:
      search["type"] === "team" || search["type"] === "monitor"
        ? (search["type"] as "monitor" | "team")
        : undefined,
    mode:
      search["mode"] === "user-search" ||
      search["mode"] === "chat-search" ||
      search["mode"] === "threads"
        ? (search["mode"] as "threads" | "user-search" | "chat-search")
        : undefined,
    f:
      search["f"] === "all" ||
      search["f"] === "escalated" ||
      search["f"] === "waiting_documents" ||
      search["f"] === "pending" ||
      search["f"] === "completed"
        ? (search["f"] as any)
        : undefined,
    userId: typeof search["userId"] === "string" ? (search["userId"] as string) : undefined,
    chatId: typeof search["chatId"] === "string" ? (search["chatId"] as string) : undefined,
    q: typeof search["q"] === "string" ? (search["q"] as string) : undefined,
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

  // ── Navigation Section: "threads" | "user-search" | "chat-search" | "team" ──
  const [sidebarSection, setSidebarSection] = useState<"threads" | "user-search" | "chat-search" | "team">(
    searchParams.type === "team"
      ? "team"
      : searchParams.mode === "user-search" || searchParams.userId
        ? "user-search"
        : searchParams.mode === "chat-search" || searchParams.chatId
          ? "chat-search"
          : "threads",
  );

  // Sync search parameters bidirectionally (handles history back/forward)
  useEffect(() => {
    setActiveId(searchParams.request);
    setSelectedTeamMemberId(searchParams.teamMember);
    if (searchParams.type) {
      setChatType(searchParams.type);
    }
    if (searchParams.type === "team") {
      setSidebarSection("team");
    } else if (searchParams.mode === "user-search" || searchParams.userId) {
      setSidebarSection("user-search");
    } else if (searchParams.mode === "chat-search" || searchParams.chatId) {
      setSidebarSection("chat-search");
    } else if (searchParams.mode === "threads") {
      setSidebarSection("threads");
    }
  }, [searchParams.request, searchParams.teamMember, searchParams.type, searchParams.mode, searchParams.userId, searchParams.chatId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentAdminId(data.user?.id ?? null));
    void notificationsApi.listQuickReplies().then(setQuickReplies).catch(() => {});
  }, []);

  // ── A. Dedicated User Search State & Handler ───────────────────────────────
  const [userIdInput, setUserIdInput] = useState(searchParams.userId || "");
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const [searchedUser, setSearchedUser] = useState<any | null>(null);
  const [searchedUserRequests, setSearchedUserRequests] = useState<any[]>([]);

  const executeUserSearch = async (targetUid?: string) => {
    const raw = (targetUid ?? userIdInput).trim();
    if (!raw) {
      toast.error("Please enter a User Unique ID");
      return;
    }
    setUserSearchLoading(true);
    setUserSearchError(null);
    setSearchedUser(null);
    setSearchedUserRequests([]);

    try {
      // 1. Try server-side privileged user search first (handles full UUID, 32-hex, partial UUID, email, phone, reference)
      const res = await adminSearchUser({ data: { query: raw } }).catch((err) => {
        console.warn("[AdminChats] adminSearchUser error:", err);
        return null;
      });

      if (res?.user) {
        setSearchedUser(res.user);
        setSearchedUserRequests(res.requests || []);
        toast.success(`Found ${res.requests?.length || 0} service requests for user`);
        return;
      }

      // 2. Client-side fallback if serverfn returned nothing
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const hex32Regex = /^[0-9a-f]{32}$/i;

      let formattedUid: string | null = null;
      if (uuidRegex.test(raw)) {
        formattedUid = raw.toLowerCase();
      } else if (hex32Regex.test(raw)) {
        formattedUid = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`.toLowerCase();
      }

      let profile: any = undefined;
      let reqs: any[] | null = null;

      // 2a. Direct search if formattedUid is a valid UUID
      if (formattedUid) {
        profile = profiles.find((p) => p.id.toLowerCase() === formattedUid);
        if (!profile) {
          const { data: profData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", formattedUid)
            .maybeSingle();
          profile = profData ?? undefined;
        }

        const { data: userReqs, error: reqErr } = await supabase
          .from("requests")
          .select("*")
          .eq("user_id", formattedUid)
          .order("created_at", { ascending: false });

        if (!reqErr && userReqs) {
          reqs = userReqs;
        }
      }

      // 2b. If not found yet, check if input matches a Chat Reference ID or title
      if (!profile && (!reqs || reqs.length === 0)) {
        const { data: chatData } = await supabase
          .from("requests")
          .select("*, profiles:user_id(*)")
          .or(`reference.eq.${raw},reference.ilike.%${raw}%`)
          .limit(1)
          .maybeSingle();

        if (chatData?.user_id) {
          formattedUid = chatData.user_id;
          profile = (chatData as any).profiles ?? undefined;
          const { data: userReqs } = await supabase
            .from("requests")
            .select("*")
            .eq("user_id", formattedUid)
            .order("created_at", { ascending: false });
          reqs = userReqs ?? [chatData];
        }
      }

      // 2c. Fallback: search profile by email, phone, or name
      if (!profile && (!reqs || reqs.length === 0)) {
        const { data: profByQuery } = await supabase
          .from("profiles")
          .select("*")
          .or(`email.ilike.%${raw}%,phone.ilike.%${raw}%,full_name.ilike.%${raw}%`)
          .limit(1)
          .maybeSingle();

        if (profByQuery) {
          profile = profByQuery;
          formattedUid = profByQuery.id;
          const { data: userReqs } = await supabase
            .from("requests")
            .select("*")
            .eq("user_id", profByQuery.id)
            .order("created_at", { ascending: false });
          reqs = userReqs ?? [];
        }
      }

      // 2d. In-memory check across cached profiles
      if (!profile && (!reqs || reqs.length === 0)) {
        const memProfile = profiles.find(
          (p) =>
            p.id.toLowerCase().includes(raw.toLowerCase()) ||
            p.id.replace(/-/g, "").toLowerCase().includes(raw.toLowerCase()) ||
            p.email?.toLowerCase().includes(raw.toLowerCase()) ||
            p.full_name?.toLowerCase().includes(raw.toLowerCase()),
        );
        if (memProfile) {
          profile = memProfile;
          formattedUid = memProfile.id;
          const { data: userReqs } = await supabase
            .from("requests")
            .select("*")
            .eq("user_id", memProfile.id)
            .order("created_at", { ascending: false });
          reqs = userReqs ?? [];
        }
      }

      // If profile was found and we still need to load requests
      if (profile?.id && !reqs) {
        const { data: userReqs } = await supabase
          .from("requests")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        reqs = userReqs ?? [];
      }

      const effectiveUid = profile?.id || formattedUid || raw;

      if (!profile && (!reqs || reqs.length === 0)) {
        setUserSearchError(`No user profile or request history found for User ID "${raw}".`);
      } else {
        setSearchedUser(
          profile || {
            id: effectiveUid,
            full_name: "User Record",
            email: "—",
            phone: "—",
            created_at: reqs?.[0]?.created_at,
          },
        );
        setSearchedUserRequests(reqs || []);
        toast.success(`Found ${reqs?.length || 0} service requests for user`);
      }
    } catch (err: any) {
      console.error("User search error:", err);
      const msg = err?.message || "Failed to search user history";
      setUserSearchError(msg);
      toast.error(msg);
    } finally {
      setUserSearchLoading(false);
    }
  };

  // Auto-run User Search if userId is passed in URL
  useEffect(() => {
    if (searchParams.userId && (searchParams.mode === "user-search" || !searchParams.mode)) {
      setUserIdInput(searchParams.userId);
      setSidebarSection("user-search");
      void executeUserSearch(searchParams.userId);
    }
  }, [searchParams.userId]);

  // ── B. Dedicated Chat Search State & Handler ───────────────────────────────
  const [chatIdInput, setChatIdInput] = useState(searchParams.chatId || "");
  const [chatSearchLoading, setChatSearchLoading] = useState(false);
  const [chatSearchError, setChatSearchError] = useState<string | null>(null);
  const [chatSearchResult, setChatSearchResult] = useState<any | null>(null);

  const executeChatSearch = async (targetCid?: string) => {
    const raw = (targetCid ?? chatIdInput).trim();
    if (!raw) {
      toast.error("Please enter a Chat ID or Reference number");
      return;
    }
    setChatSearchLoading(true);
    setChatSearchError(null);
    setChatSearchResult(null);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
      let query = supabase.from("requests").select("*");
      if (isUuid) {
        query = query.eq("id", raw);
      } else {
        query = query.or(`reference.eq.${raw},reference.ilike.%${raw}%`);
      }

      let { data } = await query.limit(1).maybeSingle();
      if (!data && !isUuid) {
        const { data: fallback } = await supabase
          .from("requests")
          .select("*")
          .ilike("id", `%${raw}%`)
          .limit(1)
          .maybeSingle();
        data = fallback;
      }

      if (data) {
        setChatSearchResult(data);
        toast.success(`Found chat ${data.reference || data.id}`);
      } else {
        setChatSearchError(`No conversation found with Chat ID "${raw}". Please check the reference.`);
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to search chat";
      setChatSearchError(msg);
      toast.error(msg);
    } finally {
      setChatSearchLoading(false);
    }
  };

  // Auto-run Chat Search if chatId is passed in URL
  useEffect(() => {
    if (searchParams.chatId && (searchParams.mode === "chat-search" || !searchParams.mode)) {
      setChatIdInput(searchParams.chatId);
      setSidebarSection("chat-search");
      void executeChatSearch(searchParams.chatId);
    }
  }, [searchParams.chatId]);

  // Open any found chat directly into the active conversation pane
  const handleOpenSelectedChat = (chatData: any) => {
    setFetchedActive(chatData);
    setActiveId(chatData.id);
    void navigate({
      to: "/admin/chats",
      search: (prev: any) => ({
        ...prev,
        request: chatData.id,
        type: "monitor",
        teamMember: undefined,
      }),
      replace: false,
    });
    toast.success(`Opened chat ${chatData.reference || chatData.id}`);
  };

  // Jump from any chat/view directly into User Search for that user
  const handleJumpToUserSearch = (uid: string) => {
    setSidebarSection("user-search");
    setUserIdInput(uid);
    void executeUserSearch(uid);
    void navigate({
      to: "/admin/chats",
      search: (prev: any) => ({
        ...prev,
        mode: "user-search",
        userId: uid,
      }),
      replace: false,
    });
  };

  // Switch between left-sidebar modes cleanly
  const handleSwitchSection = (section: "threads" | "user-search" | "chat-search" | "team") => {
    setSidebarSection(section);
    if (section === "team") {
      setChatType("team");
      setActiveId(undefined);
      void navigate({
        to: "/admin/chats",
        search: (prev: any) => ({
          ...prev,
          type: "team",
          mode: undefined,
          request: undefined,
        }),
        replace: true,
      });
    } else {
      setChatType("monitor");
      setSelectedTeamMemberId(undefined);
      void navigate({
        to: "/admin/chats",
        search: (prev: any) => ({
          ...prev,
          type: "monitor",
          mode: section === "threads" ? undefined : section,
          teamMember: undefined,
        }),
        replace: true,
      });
    }
  };

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

  const [activeEscalationNote, setActiveEscalationNote] = useState<string | null>(null);

  useEffect(() => {
    if (!active?.id || !active.is_escalated) {
      setActiveEscalationNote(null);
      return;
    }
    let note = (active as any).escalation_reason || "";
    if (!note && Array.isArray((active as any).tags)) {
      const match = (active as any).tags.find((t: string) => t.startsWith("esc_note:"));
      if (match) {
        try {
          note = decodeURIComponent(match.slice(9));
        } catch {
          note = match.slice(9);
        }
      }
    }
    if (note) {
      setActiveEscalationNote(note);
      return;
    }
    // Fallback: check chat_escalations table
    void (async () => {
      try {
        const { data } = await (supabase as any)
          .from("chat_escalations")
          .select("reason")
          .eq("request_id", active.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.reason) {
          setActiveEscalationNote(data.reason);
        }
      } catch (_) {}
    })();
  }, [active?.id, (active as any)?.is_escalated, (active as any)?.escalation_reason, (active as any)?.tags]);

  const activePaymentStatus = useMemo(() => {
    if (!active) return "pending";
    if ((active as any).payment_status) return (active as any).payment_status;
    if (Array.isArray((active as any).tags)) {
      const pTag = (active as any).tags.find((t: string) => t.startsWith("payment:"));
      if (pTag) return pTag.slice(8);
    }
    return "pending";
  }, [active]);

  const activePaymentNote = useMemo(() => {
    if (!active) return "";
    if ((active as any).payment_notes) return (active as any).payment_notes;
    if (Array.isArray((active as any).tags)) {
      const pTag = (active as any).tags.find((t: string) => t.startsWith("pnote:"));
      if (pTag) {
        try {
          return decodeURIComponent(pTag.slice(6));
        } catch {
          return pTag.slice(6);
        }
      }
    }
    return "";
  }, [active]);

  const [adminPaymentNoteInput, setAdminPaymentNoteInput] = useState("");
  useEffect(() => {
    setAdminPaymentNoteInput(activePaymentNote);
  }, [activePaymentNote]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const [filterTab, setFilterTab] = useState<
    "all" | "escalated" | "waiting_documents" | "pending" | "completed"
  >(searchParams.f || "all");

  useEffect(() => {
    if (searchParams.f) {
      setFilterTab(searchParams.f);
    }
  }, [searchParams.f]);

  const [userChatHistory, setUserChatHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  useEffect(() => {
    if (!active?.user_id || chatType !== "monitor") {
      setUserChatHistory([]);
      return;
    }
    let isMounted = true;
    setLoadingHistory(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("requests")
          .select("id, reference, title, status, created_at, last_activity_at, is_escalated")
          .eq("user_id", active.user_id)
          .order("created_at", { ascending: false })
          .limit(30);
        if (isMounted) {
          setLoadingHistory(false);
          if (!error && data) {
            setUserChatHistory(data);
          }
        }
      } catch (_) {
        if (isMounted) setLoadingHistory(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [active?.user_id, chatType]);

  // Fetch page for monitor
  useEffect(() => {
    if (chatType === "monitor") {
      void fetchRequestsPage(page, {
        search: debouncedQ || undefined,
        limit: pageSize,
      });
    }
  }, [page, debouncedQ, fetchRequestsPage, chatType]);

  const threads = useMemo(() => {
    return customerRequests.filter((r) => {
      if (filterTab === "escalated" && !r.is_escalated) return false;
      if (filterTab === "waiting_documents" && r.status !== "waiting_documents") return false;
      if (filterTab === "pending" && r.status !== "pending" && r.status !== "assigned") return false;
      if (filterTab === "completed" && r.status !== "completed") return false;
      return true;
    });
  }, [customerRequests, filterTab]);

  const handleExportCsv = () => {
    const headers = [
      "Chat ID",
      "User ID",
      "User Name",
      "Title",
      "Status",
      "Priority",
      "Escalated",
      "Assigned Agent",
      "Created At",
      "Last Activity",
    ];
    const rows = threads.map((r) => [
      r.reference || r.id,
      r.user_id,
      profileOf(r.user_id)?.full_name ?? "User",
      r.title,
      STATUS_LABEL[r.status] || r.status,
      r.priority ?? "medium",
      r.is_escalated ? "Yes" : "No",
      profileOf(r.assigned_team_id)?.full_name ?? "Unassigned",
      r.created_at,
      r.last_activity_at || r.created_at,
    ]);
    downloadCsv("admin_customer_chats", headers, rows);
    toast.success(`Exported ${rows.length} chats to CSV`);
  };

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
      search: (prev: any) => ({ ...prev, request: id, type: "monitor", teamMember: undefined }),
      replace: false,
    });
  };

  // When team member is selected in Team Chat mode
  const handleSelectTeamMember = async (tmId: string, name?: string) => {
    setSelectedTeamMemberId(tmId);
    void navigate({
      to: "/admin/chats",
      search: (prev: any) => ({ ...prev, teamMember: tmId, type: "team", request: undefined }),
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
      search: (prev: any) => ({
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
      onMessage: (msgRow) => {
        const fullMsg: messagesApi.MessageWithDoc = {
          ...msgRow,
          attachment: (msgRow as any).attachment ?? null,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === msgRow.id)) return prev;
          return [...prev, fullMsg];
        });
        if (msgRow.attachment_id) {
          void messagesApi.listMessages(room.id, { limit: 100 }).then((rows) => {
            if (alive) setMessages(rows);
          });
        }
      },
      onMessageUpdate: (msgRow) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgRow.id
              ? { ...m, ...msgRow, attachment: (msgRow as any).attachment ?? m.attachment }
              : m,
          ),
        );
      },
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [room]);

  const {
    containerRef: scrollContainerRef,
    handleScroll,
    scrollToBottom,
    isAtBottom,
    hasNewUnseen,
  } = useChatScroll<HTMLDivElement>({
    items: messages,
    chatId: room?.id,
  });

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
      scrollToBottom("smooth");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setBusy(false);
    }
  };

  const [uploadingQuickImage, setUploadingQuickImage] = useState(false);
  const quickImageFileRef = useRef<HTMLInputElement>(null);

  const sendQuickReplyDirect = async (body: string) => {
    if (!room || !active || !body.trim()) return;
    setBusy(true);
    try {
      await messagesApi.sendMessage({
        chatRoomId: room.id,
        requestId: active.id,
        body: body.trim(),
        senderRole: "admin",
      });
      setShowQuickReplies(false);
      setDraft("");
      scrollToBottom("smooth");
      toast.success("Quick reply sent");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send quick reply");
    } finally {
      setBusy(false);
    }
  };

  const handleSendQuickImage = async (file: File) => {
    if (!file || !room || !active) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WebP)");
      return;
    }
    setUploadingQuickImage(true);
    try {
      const storagePath = `quick_replies/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(storagePath, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);
      if (data?.publicUrl) {
        const bodyWithImage = notificationsApi.formatQuickReplyWithImage(
          draft.startsWith("/") ? "" : draft.trim(),
          data.publicUrl,
        );
        await messagesApi.sendMessage({
          chatRoomId: room.id,
          requestId: active.id,
          body: bodyWithImage,
          senderRole: "admin",
        });
        setShowQuickReplies(false);
        setDraft("");
        scrollToBottom("smooth");
        toast.success("Image sent via Quick Replies");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload and send image");
    } finally {
      setUploadingQuickImage(false);
      if (quickImageFileRef.current) quickImageFileRef.current.value = "";
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
          title={
            sidebarSection === "user-search"
              ? "User Search"
              : sidebarSection === "chat-search"
                ? "Chat Search"
                : sidebarSection === "team"
                  ? `Team Direct (${team.length})`
                  : "Customer Chats"
          }
          className={cn("h-full overflow-y-auto", isMobileDetailOpen ? "hidden xl:block" : "block")}
        >
          {/* Dedicated Section Mode Switcher */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-surface-2 rounded-xl border border-border-subtle mb-3 shrink-0">
            <button
              type="button"
              onClick={() => handleSwitchSection("threads")}
              className={cn(
                "flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all",
                sidebarSection === "threads"
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface-3",
              )}
              title="Active Chats List"
            >
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="truncate">Chats</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchSection("user-search")}
              className={cn(
                "flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all",
                sidebarSection === "user-search"
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface-3",
              )}
              title="Search by Unique User ID"
            >
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">User Search</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchSection("chat-search")}
              className={cn(
                "flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all",
                sidebarSection === "chat-search"
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface-3",
              )}
              title="Search by Chat ID"
            >
              <Search className="h-3 w-3 shrink-0" />
              <span className="truncate">Chat Search</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchSection("team")}
              className={cn(
                "flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all",
                sidebarSection === "team"
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface-3",
              )}
              title="Team Direct Chats"
            >
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">Team</span>
            </button>
          </div>

          {/* ── 1. ACTIVE THREADS / REQUESTS LIST ── */}
          {sidebarSection === "threads" && (
            <>
              <div className="mb-3 space-y-2">
                <SearchBox
                  value={q}
                  onChange={setQ}
                  label="Search chats"
                  placeholder="Filter conversations by customer, title..."
                />

                {filterTab === "escalated" && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-center gap-2 text-[11px] text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold">Escalated Folder</span>
                      <span className="text-text-muted ml-1.5 hidden sm:inline">
                        ({threads.length} escalated {threads.length === 1 ? "chat" : "chats"})
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-1 pt-1">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                    {[
                      { id: "all", label: "All" },
                      { id: "escalated", label: "Escalated" },
                      { id: "waiting_documents", label: "Waiting Docs" },
                      { id: "pending", label: "Pending" },
                      { id: "completed", label: "Done" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilterTab(tab.id as any)}
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-full transition-colors shrink-0 ${
                          filterTab === tab.id
                            ? "bg-brand text-white shadow-sm"
                            : "bg-surface-2 text-text-muted hover:text-text"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    title="Export Chats CSV"
                    className="inline-flex items-center gap-1 shrink-0 rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-text-secondary hover:text-text hover:bg-surface-3 transition-colors"
                  >
                    <Download className="h-2.5 w-2.5" />
                    CSV
                  </button>
                </div>
              </div>

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
                          <h3 className="truncate text-xs font-bold text-text group-hover:text-brand transition-colors">
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
                  <li className="py-6 text-center text-xs text-text-muted">No conversations found.</li>
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
          )}

          {/* ── 2. DEDICATED USER SEARCH SECTION ── */}
          {sidebarSection === "user-search" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-brand" />
                  <h3 className="text-xs font-bold text-text">User Search</h3>
                </div>
                <p className="text-[11px] text-text-secondary">
                  Search by a user's Unique User ID to inspect all their past chats, complete service request history, and current statuses.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void executeUserSearch();
                  }}
                  className="mt-3 flex gap-1.5"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={userIdInput}
                      onChange={(e) => setUserIdInput(e.target.value)}
                      placeholder="Enter Unique User ID (UUID)..."
                      className={`${inputClass} text-xs h-9 pr-7`}
                    />
                    {userIdInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserIdInput("");
                          setSearchedUser(null);
                          setSearchedUserRequests([]);
                          setUserSearchError(null);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5"
                        title="Clear input"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={userSearchLoading || !userIdInput.trim()}
                    className="h-9 px-3 text-xs shrink-0"
                  >
                    {userSearchLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5 mr-1" />
                    )}
                    Search
                  </Button>
                </form>
              </div>

              {userSearchError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <p className="font-semibold">{userSearchError}</p>
                  <p className="text-[11px] text-text-muted mt-1">Please verify the user's Unique ID.</p>
                </div>
              )}

              {searchedUser && (
                <div className="space-y-3">
                  {/* User Profile Card */}
                  <div className="rounded-xl border border-border-subtle bg-surface-2 p-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-text">
                          {searchedUser.full_name || "Unnamed User"}
                        </h4>
                        <p className="text-[11px] text-text-muted">{searchedUser.email || "No email"}</p>
                        {searchedUser.phone && (
                          <p className="text-[11px] text-text-muted">Phone: {searchedUser.phone}</p>
                        )}
                      </div>
                      <Pill tone={searchedUser.is_active === false ? "bad" : "ok"}>
                        {searchedUser.is_active === false ? "Suspended" : "Active"}
                      </Pill>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-bg p-2 border border-border-subtle">
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-text-muted block">Unique User ID</span>
                        <code className="text-[10px] font-mono text-text block truncate max-w-[210px]">
                          {searchedUser.id}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(searchedUser.id, "User ID")}
                        className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-3 transition-colors shrink-0"
                        title="Copy User ID"
                      >
                        {copiedText === "User ID" ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>

                    {/* Breakdown Counts */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                      <div className="rounded-lg bg-bg p-1.5 border border-border-subtle">
                        <span className="text-[9px] text-text-muted block">Total Requests</span>
                        <span className="text-xs font-bold text-text">{searchedUserRequests.length}</span>
                      </div>
                      <div className="rounded-lg bg-bg p-1.5 border border-border-subtle">
                        <span className="text-[9px] text-text-muted block">Completed</span>
                        <span className="text-xs font-bold text-emerald-400">
                          {searchedUserRequests.filter((r) => r.status === "completed").length}
                        </span>
                      </div>
                      <div className="rounded-lg bg-bg p-1.5 border border-border-subtle">
                        <span className="text-[9px] text-text-muted block">Pending / Active</span>
                        <span className="text-xs font-bold text-brand">
                          {searchedUserRequests.filter((r) => r.status !== "completed" && r.status !== "cancelled").length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Requests & Chats History List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-brand" />
                        All Previous Chats & Service Requests ({searchedUserRequests.length})
                      </h4>
                    </div>

                    {searchedUserRequests.length === 0 ? (
                      <div className="py-6 text-center text-xs text-text-muted bg-surface-2 rounded-xl border border-border-subtle p-4">
                        No historical chats or service requests found for this user.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {searchedUserRequests.map((req) => {
                          const isSelected = active?.id === req.id;
                          return (
                            <div
                              key={req.id}
                              className={cn(
                                "rounded-xl border p-3 transition-all bg-bg",
                                isSelected
                                  ? "border-brand bg-brand/10 shadow-sm"
                                  : "border-border-subtle hover:border-border-strong",
                              )}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono text-[10px] font-bold text-brand truncate">
                                    {req.reference || req.id.slice(0, 8)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(req.reference || req.id, "Chat ID")}
                                    className="text-text-muted hover:text-text p-0.5"
                                    title="Copy Chat ID"
                                  >
                                    <Copy className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                                <time className="text-[10px] text-text-muted shrink-0">
                                  {formatDate(req.created_at)}
                                </time>
                              </div>

                              <h5 className="text-xs font-bold text-text truncate mb-1">
                                {req.title}
                              </h5>

                              {req.category && (
                                <span className="inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[9px] text-text-muted mb-2">
                                  {req.category}
                                </span>
                              )}

                              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border-subtle">
                                <div className="flex items-center gap-1.5">
                                  <Pill tone={req.status === "completed" ? "ok" : "brand"}>
                                    {STATUS_LABEL[req.status as DbRequestStatus] || req.status}
                                  </Pill>
                                  {req.is_escalated && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400">
                                      <AlertTriangle className="h-2.5 w-2.5" /> Escalated
                                    </span>
                                  )}
                                </div>

                                <Button
                                  type="button"
                                  variant={isSelected ? "primary" : "ghost"}
                                  className="h-7 px-2.5 text-[11px] font-semibold"
                                  onClick={() => handleOpenSelectedChat(req)}
                                >
                                  {isSelected ? (
                                    <span className="flex items-center gap-1 text-emerald-400">
                                      <Check className="h-3 w-3" /> Active
                                    </span>
                                  ) : (
                                    "Open Chat"
                                  )}
                                </Button>
                              </div>

                              <div className="mt-2 text-[10px] text-text-muted flex items-center justify-between">
                                <span>Agent: {profileOf(req.assigned_team_id)?.full_name ?? "Unassigned"}</span>
                                {req.last_activity_at && (
                                  <span>Activity: {formatDate(req.last_activity_at)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!searchedUser && !userSearchLoading && !userSearchError && (
                <div className="py-10 text-center px-4">
                  <User className="h-10 w-10 mx-auto text-text-muted/40 mb-2" />
                  <p className="text-xs font-semibold text-text">No User Selected</p>
                  <p className="text-[11px] text-text-muted mt-1">
                    Enter a User's Unique User ID above to review their full request history and open any associated chat.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── 3. DEDICATED CHAT SEARCH SECTION ── */}
          {sidebarSection === "chat-search" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="h-4 w-4 text-brand" />
                  <h3 className="text-xs font-bold text-text">Chat Search</h3>
                </div>
                <p className="text-[11px] text-text-secondary">
                  Search for an individual conversation directly by its Chat ID or Reference number (e.g. FRM-XXXX or UUID).
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void executeChatSearch();
                  }}
                  className="mt-3 flex gap-1.5"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={chatIdInput}
                      onChange={(e) => setChatIdInput(e.target.value)}
                      placeholder="Enter Chat ID (e.g. FRM-1024 or UUID)..."
                      className={`${inputClass} text-xs h-9 pr-7`}
                    />
                    {chatIdInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setChatIdInput("");
                          setChatSearchResult(null);
                          setChatSearchError(null);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5"
                        title="Clear input"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={chatSearchLoading || !chatIdInput.trim()}
                    className="h-9 px-3 text-xs shrink-0"
                  >
                    {chatSearchLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5 mr-1" />
                    )}
                    Find Chat
                  </Button>
                </form>
              </div>

              {chatSearchError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <p className="font-semibold">{chatSearchError}</p>
                  <p className="text-[11px] text-text-muted mt-1">
                    Please verify the Chat ID or reference number and try again.
                  </p>
                </div>
              )}

              {chatSearchResult && (
                <div className="space-y-3">
                  <div
                    className={cn(
                      "rounded-xl border p-4 transition-all bg-bg space-y-3",
                      active?.id === chatSearchResult.id
                        ? "border-brand bg-brand/10 shadow-sm"
                        : "border-border-subtle",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-brand truncate">
                          {chatSearchResult.reference || chatSearchResult.id}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(chatSearchResult.reference || chatSearchResult.id, "Chat ID")
                          }
                          className="text-text-muted hover:text-text p-0.5"
                          title="Copy Chat ID"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <Pill tone={chatSearchResult.status === "completed" ? "ok" : "brand"}>
                        {STATUS_LABEL[chatSearchResult.status as DbRequestStatus] || chatSearchResult.status}
                      </Pill>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-text">{chatSearchResult.title}</h4>
                      {chatSearchResult.category && (
                        <span className="inline-block mt-1 rounded bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
                          {chatSearchResult.category}
                        </span>
                      )}
                    </div>

                    {/* Customer info with 1-click jump to User Search */}
                    <div className="rounded-lg bg-surface-2 p-2.5 border border-border-subtle space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-text-muted">Customer:</span>
                        <span className="text-xs font-bold text-text">
                          {profileOf(chatSearchResult.user_id)?.full_name ?? "User"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold text-text-muted">User ID:</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <code className="text-[10px] font-mono text-text-secondary truncate max-w-[130px]">
                            {chatSearchResult.user_id}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(chatSearchResult.user_id, "User ID")}
                            className="text-text-muted hover:text-text p-0.5"
                            title="Copy User ID"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJumpToUserSearch(chatSearchResult.user_id)}
                        className="text-[10px] font-semibold text-brand hover:underline flex items-center gap-1 pt-1"
                      >
                        <User className="h-3 w-3" /> View this user's full history & chats →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-text-muted">
                      <div>
                        <span className="block font-semibold text-text-secondary">Assigned Agent:</span>
                        <span>{profileOf(chatSearchResult.assigned_team_id)?.full_name ?? "Unassigned"}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-text-secondary">Priority:</span>
                        <span className="capitalize">{chatSearchResult.priority || "medium"}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-text-secondary">Created:</span>
                        <span>{formatDate(chatSearchResult.created_at)}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-text-secondary">Last Active:</span>
                        <span>{formatDate(chatSearchResult.last_activity_at || chatSearchResult.created_at)}</span>
                      </div>
                    </div>

                    {chatSearchResult.is_escalated && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>This conversation is escalated to Admin</span>
                      </div>
                    )}

                    <Button
                      type="button"
                      className="w-full text-xs font-bold h-9"
                      onClick={() => handleOpenSelectedChat(chatSearchResult)}
                    >
                      {active?.id === chatSearchResult.id ? (
                        <span className="flex items-center justify-center gap-1 text-emerald-400">
                          <Check className="h-4 w-4" /> Chat Currently Open in Right Pane
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" /> Open Chat in View
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {!chatSearchResult && !chatSearchLoading && !chatSearchError && (
                <div className="py-10 text-center px-4">
                  <Search className="h-10 w-10 mx-auto text-text-muted/40 mb-2" />
                  <p className="text-xs font-semibold text-text">No Chat Selected</p>
                  <p className="text-[11px] text-text-muted mt-1">
                    Enter a Chat ID or Reference number above to locate and open the conversation directly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── 4. TEAM DIRECT CHATS ── */}
          {sidebarSection === "team" && (
            <div className="space-y-3">
              <SearchBox
                value={q}
                onChange={setQ}
                label="Search team"
                placeholder="Team member, code..."
              />
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h3 className="truncate text-xs font-bold text-text">
                              {profile?.full_name || "Team Member"}
                            </h3>
                            <PresenceDot
                              availability={(member as any).availability}
                              lastSeenAt={(member as any).last_seen_at}
                            />
                          </div>
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
            </div>
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
                  {active.is_escalated && (() => {
                    const escNote =
                      (active as any).escalation_reason ||
                      activeEscalationNote ||
                      (() => {
                        if (Array.isArray((active as any).tags)) {
                          const match = (active as any).tags.find((t: string) =>
                            t.startsWith("esc_note:"),
                          );
                          if (match) {
                            try {
                              return decodeURIComponent(match.slice(9));
                            } catch {
                              return match.slice(9);
                            }
                          }
                        }
                        return "";
                      })();
                    return (
                      <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2.5 shrink-0 shadow-lg shadow-amber-950/20">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                              <AlertTriangle className="h-4 w-4" />
                            </span>
                            <div className="text-xs">
                              <span className="font-bold text-amber-300">Escalated to Admin</span>
                              <span className="text-text-muted ml-1.5 hidden sm:inline">
                                Requires supervisor review & resolution
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await requestsApi.resolveEscalation(active.id, "resolved");
                                toast.success("Escalation marked as resolved");
                                void fetchRequestsPage(page);
                                refresh();
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to resolve escalation");
                              }
                            }}
                            className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-black hover:bg-amber-400 transition-colors shrink-0 shadow-xs"
                          >
                            Resolve Escalation
                          </button>
                        </div>

                        {/* Prominently render the team member's escalation note */}
                        <div className="rounded-lg border border-amber-500/25 bg-black/40 p-2.5 text-xs">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                            <FileText className="h-3 w-3" />
                            <span>Escalation Note / Reason:</span>
                          </div>
                          <p className="text-amber-100 whitespace-pre-wrap font-medium leading-relaxed">
                            {escNote || "No specific note provided with this escalation."}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 space-y-4 overflow-y-auto pr-2 py-2 relative"
                  >
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
                          className={`flex group ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl border px-4 py-3 text-xs shadow-sm relative ${
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
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] text-text-muted">
                                    {formatDate(m.created_at)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (window.confirm("Are you sure you want to delete this message?")) {
                                        try {
                                          await messagesApi.deleteChatMessage(m.id);
                                          setMessages((prev) => prev.filter((msg) => msg.id !== m.id));
                                          toast.success("Message deleted");
                                        } catch (err: any) {
                                          toast.error(err?.message || "Failed to delete message");
                                        }
                                      }
                                    }}
                                    className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100 transition-opacity text-text-muted hover:text-red-400 p-1 rounded"
                                    title="Delete message"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                            {m.body && (() => {
                              const { imageUrl, cleanBody } = notificationsApi.extractQuickReplyImage(m.body);
                              return (
                                <div className="space-y-2">
                                  {imageUrl && (
                                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                                      <img
                                        src={imageUrl}
                                        alt="Attachment"
                                        className="max-h-60 w-auto max-w-full rounded-xl object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                        onClick={() => window.open(imageUrl, "_blank")}
                                      />
                                    </div>
                                  )}
                                  {cleanBody && (
                                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                                      {cleanBody}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
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

                    {!isAtBottom && (
                      <button
                        type="button"
                        onClick={() => scrollToBottom("smooth")}
                        className="sticky bottom-2 ml-auto mr-0 z-20 flex items-center gap-1.5 rounded-full bg-surface-2/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xl backdrop-blur-md border border-border-subtle hover:bg-surface-3 transition-all animate-in fade-in slide-in-from-bottom-2"
                        aria-label="Scroll to latest messages"
                      >
                        {hasNewUnseen && (
                          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                        )}
                        <span>{hasNewUnseen ? "New message" : "Latest"}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                      </button>
                    )}
                  </div>

                  <div className="mt-auto border-t border-border-subtle pt-4 bg-surface-1/50 -mx-4 px-4 pb-2 relative">
                    {/* Quick Replies Popup on '/' shortcut */}
                    {(showQuickReplies || draft.startsWith("/")) && quickReplies.length > 0 && (
                      <div className="absolute bottom-full left-4 mb-2 w-[min(22rem,calc(100vw-3rem))] max-h-72 overflow-y-auto rounded-2xl border border-border-subtle bg-surface-1 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="mb-2 px-2 pb-2 pt-1 text-[11px] font-semibold text-text-muted border-b border-border-subtle flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-bold text-white shrink-0">
                            <Zap className="h-3.5 w-3.5 text-brand" /> Quick Replies
                          </span>
                          <div className="flex items-center gap-1.5">
                            {draft.startsWith("/") && (
                              <span className="text-[10px] text-brand-light font-mono hidden sm:inline">
                                Type to filter
                              </span>
                            )}
                            <label
                              className={cn(
                                "inline-flex items-center gap-1 rounded-lg bg-brand/15 hover:bg-brand text-brand hover:text-black border border-brand/30 text-[10px] px-2 py-0.5 font-bold transition-all cursor-pointer shadow-xs",
                                uploadingQuickImage && "opacity-50 cursor-not-allowed",
                              )}
                              title="Upload and send image directly through Quick Replies"
                            >
                              {uploadingQuickImage ? (
                                <Loader2 className="h-3 w-3 animate-spin text-brand" />
                              ) : (
                                <ImageIcon className="h-3 w-3" />
                              )}
                              <span>{uploadingQuickImage ? "Sending…" : "Send Image"}</span>
                              <input
                                ref={quickImageFileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingQuickImage}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void handleSendQuickImage(f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
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

                          return filtered.map((qr) => {
                            const { imageUrl, cleanBody } = notificationsApi.extractQuickReplyImage(qr.body);
                            return (
                              <div
                                key={qr.id}
                                className="w-full text-left rounded-xl px-2.5 py-2 text-sm text-text hover:bg-surface-2 transition-colors mb-1 group flex items-start gap-2.5 cursor-pointer"
                                onClick={() => {
                                  setDraft(qr.body);
                                  setShowQuickReplies(false);
                                }}
                              >
                                {imageUrl && (
                                  <img
                                    src={imageUrl}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-md object-cover border border-white/10 bg-black/40 mt-0.5"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate text-xs text-white group-hover:text-brand transition-colors flex items-center justify-between gap-1.5">
                                    <span className="truncate">{qr.title}</span>
                                    {imageUrl && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void sendQuickReplyDirect(qr.body);
                                        }}
                                        className="inline-flex items-center gap-1 rounded bg-brand/20 hover:bg-brand text-brand hover:text-black border border-brand/40 px-2 py-0.5 text-[10px] font-bold transition-all shrink-0"
                                        title="Send image immediately to chat"
                                      >
                                        <Send className="h-2.5 w-2.5" />
                                        <span>Send Image</span>
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-text-muted truncate mt-0.5 leading-tight">
                                    {cleanBody}
                                  </div>
                                </div>
                              </div>
                            );
                          });
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
                            <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle">
                              <p className="text-[10px] text-text-muted uppercase font-bold mb-1">
                                Priority
                              </p>
                              <select
                                className={`${inputClass} h-8 text-[11px] capitalize`}
                                value={active.priority ?? "medium"}
                                onChange={(e) =>
                                  void requestsApi
                                    .updateRequestPriority(active.id, e.target.value as any)
                                    .then(() => refresh())
                                }
                              >
                                <option value="low">Low Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="high">High Priority</option>
                              </select>
                            </div>

                            <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-text-muted uppercase font-bold flex items-center gap-1">
                                  <CreditCard className="h-3 w-3 text-brand" /> Payment Status
                                </p>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-light">
                                  {activePaymentStatus}
                                </span>
                              </div>
                              <select
                                className={`${inputClass} h-8 text-[11px] capitalize`}
                                value={activePaymentStatus}
                                onChange={(e) => {
                                  const ps = e.target.value as any;
                                  void requestsApi
                                    .updatePaymentStatus(active.id, ps, activePaymentNote || undefined)
                                    .then(() => {
                                      toast.success(`Payment status updated to ${ps}`);
                                      refresh();
                                    });
                                }}
                              >
                                <option value="ready">Ready</option>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="waived">Waived</option>
                                <option value="unpaid">Unpaid</option>
                                <option value="failed">Failed</option>
                              </select>

                              <div className="pt-2 border-t border-white/5 space-y-1.5">
                                <p className="text-[10px] text-text-muted uppercase font-bold flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> Payment Notes
                                </p>
                                <textarea
                                  rows={2}
                                  placeholder="Add transaction ID, UPI ref, cash notes..."
                                  value={adminPaymentNoteInput}
                                  onChange={(e) => setAdminPaymentNoteInput(e.target.value)}
                                  className={`${inputClass} text-xs py-1.5 resize-none`}
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await requestsApi.updatePaymentStatus(
                                        active.id,
                                        activePaymentStatus as any,
                                        adminPaymentNoteInput,
                                      );
                                      toast.success("Payment note saved");
                                      refresh();
                                    } catch (err: any) {
                                      toast.error(err?.message || "Failed to save payment note");
                                    }
                                  }}
                                  className="w-full rounded-lg bg-surface-3 px-2 py-1 text-[11px] font-bold text-white hover:bg-surface-4 transition-colors border border-white/10"
                                >
                                  Save Payment Note
                                </button>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle space-y-2">
                              <div>
                                <p className="text-[10px] text-text-muted uppercase font-bold">
                                  User
                                </p>
                                <p className="text-xs text-text font-medium">
                                  {profileOf(active.user_id)?.full_name ?? "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-text-muted uppercase font-bold">
                                  Team Member
                                </p>
                                <p className="text-xs text-text font-medium">
                                  {profileOf(active.assigned_team_id)?.full_name ?? "Unassigned"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </section>

                        <section className="border-t border-border-subtle pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand flex items-center gap-1.5">
                              <History className="h-3.5 w-3.5" /> Previous User Chats ({userChatHistory.length})
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                handleJumpToUserSearch(active.user_id);
                              }}
                              className="text-[10px] font-semibold text-brand hover:underline flex items-center gap-1"
                              title="Search this user's complete history"
                            >
                              <User className="h-3 w-3" /> User Search →
                            </button>
                          </div>

                          {/* User ID & Chat ID copy shortcuts */}
                          <div className="mb-3 space-y-1.5 rounded-xl border border-border-subtle bg-surface-2 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-text-muted">User ID:</span>
                              <div className="flex items-center gap-1 min-w-0">
                                <code className="truncate font-mono text-[10px] text-text max-w-[130px]">
                                  {active.user_id}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(active.user_id, "User ID")}
                                  className="rounded p-1 text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
                                  title="Copy User ID"
                                >
                                  {copiedText === "User ID" ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-text-muted">Chat ID:</span>
                              <div className="flex items-center gap-1 min-w-0">
                                <code className="truncate font-mono text-[10px] text-brand font-semibold max-w-[130px]">
                                  {active.reference || active.id}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(active.reference || active.id, "Chat ID")}
                                  className="rounded p-1 text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
                                  title="Copy Chat ID"
                                >
                                  {copiedText === "Chat ID" ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Previous chats list for this user */}
                          {loadingHistory ? (
                            <div className="flex items-center justify-center py-4 text-xs text-text-muted">
                              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5 text-brand" /> Loading previous chats...
                            </div>
                          ) : userChatHistory.length === 0 ? (
                            <p className="text-[11px] text-text-muted py-2 text-center">
                              No previous chats found for this user.
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {userChatHistory.map((prevReq) => {
                                const isCurrent = prevReq.id === active.id;
                                return (
                                  <button
                                    key={prevReq.id}
                                    type="button"
                                    onClick={() => handleSelectRequest(prevReq.id)}
                                    className={cn(
                                      "w-full text-left rounded-xl border p-2 transition-all block",
                                      isCurrent
                                        ? "border-brand bg-brand/10 shadow-xs"
                                        : "border-border-subtle bg-surface-2 hover:border-border-strong hover:bg-surface-3",
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="font-mono text-[10px] font-bold text-text-secondary truncate">
                                        {prevReq.reference || prevReq.id.slice(0, 8)}
                                      </span>
                                      <span className="text-[9px] text-text-muted">
                                        {formatDate(prevReq.created_at)}
                                      </span>
                                    </div>
                                    <p className="text-xs font-semibold text-text truncate">{prevReq.title}</p>
                                    <div className="mt-1 flex items-center justify-between gap-1">
                                      <span className="text-[9px] text-text-muted capitalize">
                                        {STATUS_LABEL[prevReq.status as DbRequestStatus] || prevReq.status}
                                      </span>
                                      {prevReq.is_escalated && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400">
                                          <AlertTriangle className="h-2.5 w-2.5" /> Escalated
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
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
