import { supabase } from "@/integrations/supabase/client";
import * as requestsApi from "@/lib/api/requests";
import * as messagesApi from "@/lib/api/messages";
import * as documentsApi from "@/lib/api/documents";
import * as notificationsApi from "@/lib/api/notifications";
import type {
  DbRequestStatus,
  DocumentRow,
  MessageRow,
  NotificationRow,
  RequestRow,
} from "@/lib/api/types";
import type {
  Priority,
  TeamDocument,
  TeamMessage,
  TeamNotification,
  TeamRequest,
  TeamStatus,
} from "@/data/team-module";

export const DB_TO_TEAM_STATUS: Record<DbRequestStatus, TeamStatus> = {
  pending: "pending",
  assigned: "pending", // Still unassigned to specific team member but marked as assigned? Usually pool.
  waiting_documents: "waiting-user",
  under_review: "under-review",
  in_progress: "under-review",
  completed: "completed",
  cancelled: "completed",
  closed: "completed",
};

export const TEAM_TO_DB_STATUS: Record<TeamStatus, DbRequestStatus> = {
  pending: "pending",
  "waiting-user": "waiting_documents",
  "under-review": "under_review",
  completed: "completed",
};

import { initialsOf, timeLabel, dayLabel, sizeLabel } from "./api/helpers";
export { initialsOf, timeLabel, dayLabel, sizeLabel };

function stamp(iso?: string | null) {
  return `${dayLabel(iso)} • ${timeLabel(iso)}`;
}
function docKind(kind?: string | null): TeamDocument["kind"] {
  return kind === "image" || kind === "pdf" ? kind : "doc";
}

export type LiveTeamSnapshot = {
  requests: TeamRequest[];
  requestsHasMore: boolean;
  messages: TeamMessage[];
  documents: TeamDocument[];
  notifications: TeamNotification[];
  /** UI request reference -> { requestId, chatRoomId } */
  rooms: Record<string, { requestId: string; chatRoomId: string | null }>;
  /** DB request id -> UI request reference */
  refByRequestId: Record<string, string>;
};

export function mapTeamRequest(
  row: RequestRow,
  _assigneeId: string,
  userName: string,
  chatRoomId?: string | null,
): TeamRequest {
  return {
    id: row.reference || row.id,
    requestUuid: row.id,
    chatRoomId: chatRoomId ?? null,
    title: row.title,
    category: row.category ?? "Government Form",
    userName,
    userInitials: initialsOf(userName),
    userId: row.user_id,
    status: DB_TO_TEAM_STATUS[row.status] ?? "pending",
    priority: (row.priority ?? "medium") as Priority,
    createdOn: dayLabel(row.created_at),
    assignedAt: stamp(row.assigned_at ?? row.created_at),
    lastUpdated: stamp(row.last_activity_at ?? row.created_at),
    lastMessage: row.last_message ?? "No messages yet.",
    unread: 0,
    progress: row.progress ?? 0,
    assigneeId: row.assigned_team_id || "",
    timeline: [{ label: "Request created", time: stamp(row.created_at) }],
    isEscalated: row.is_escalated ?? false,
    tags: Array.isArray(row.tags) ? row.tags : [],
    assignedAtRaw: row.assigned_at ?? row.created_at ?? null,
    lastActivityAt: row.last_activity_at ?? row.created_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
  };
}

export function mapTeamMessage(
  row: MessageRow & { attachment?: DocumentRow | null },
  reference: string,
  memberName: string,
): TeamMessage {
  const mine = row.sender_role === "team" || row.sender_role === "admin";
  return {
    id: row.id,
    requestId: reference,
    requestUuid: row.request_id,
    chatRoomId: row.chat_room_id,
    senderId: row.sender_id ?? undefined,
    author: mine ? "team" : "user",
    authorName: mine ? memberName : "User",
    time: timeLabel(row.created_at),
    text: row.body ?? undefined,
    isSystem: row.is_system,
    callLog: (row.reactions as any)?.call_log ?? undefined,
    documentId: row.attachment_id ?? undefined,
    read: mine ? undefined : Boolean(row.seen),
    delivery: mine ? (row.seen ? "read" : "delivered") : undefined,
    edited: Boolean(row.edited),
  };
}

export function mapTeamDocument(row: DocumentRow, reference: string): TeamDocument {
  return {
    id: row.id,
    name: row.file_name,
    kind: docKind(row.kind),
    size: sizeLabel(row.size_bytes),
    uploadedAt: stamp(row.created_at),
    uploadedBy: row.uploader_role === "user" ? "User" : "You",
    requestId: reference,
    storagePath: row.storage_path ?? undefined,
    userId: row.uploaded_by,
  };
}

export function mapTeamNotification(
  row: NotificationRow,
  refByRequestId?: Record<string, string>,
): TeamNotification {
  const allowed = ["assigned", "message", "document", "status", "admin"] as const;
  const type = (allowed as readonly string[]).includes(row.type)
    ? (row.type as TeamNotification["type"])
    : "message";
  return {
    id: row.id,
    type,
    text: row.title || row.body || "Update",
    time: timeLabel(row.created_at),
    read: Boolean(row.is_read),
    // Deep-links the notification back to the thread it belongs to.
    requestId: row.request_id ? refByRequestId?.[row.request_id] : undefined,
  };
}

export async function loadTeamSnapshot(
  memberId: string,
  memberName: string,
): Promise<LiveTeamSnapshot> {
  // Load both assigned and unassigned (pool) requests
  const limit = 20;
  
  // 1. Load the team member's own assigned requests (active + completed)
  const { data: myRequests } = await supabase
    .from("requests")
    .select("*")
    .eq("assigned_team_id", memberId)
    .order("last_activity_at", { ascending: false })
    .limit(100);

  // 2. Load the top 20 active pool requests
  const { data: poolRows, count } = await requestsApi.listRequestsPaginated({ archived: false, limit });

  // Helper to ensure internal Admin direct chats never pollute Work requests
  const isUserReq = (r: RequestRow) =>
    r.category !== "Team Direct Report" &&
    !r.reference?.startsWith("ADM-TM") &&
    !r.title?.toLowerCase().startsWith("direct chat");

  // Merge and deduplicate
  const map = new Map<string, RequestRow>();
  for (const r of poolRows ?? []) if (isUserReq(r)) map.set(r.id, r);
  for (const r of myRequests ?? []) if (isUserReq(r)) map.set(r.id, r);
  const rows = Array.from(map.values()).sort(
    (a, b) => new Date(b.last_activity_at ?? 0).getTime() - new Date(a.last_activity_at ?? 0).getTime()
  );

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const names: Record<string, string> = {};
  if (userIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const p of data ?? []) names[p.id] = p.full_name || p.email || "User";
  }

  // Fetch ALL chat rooms for ALL active requests in a single batch query.
  // This ensures rooms.current is populated for every request, not just the
  // first 20, so setStatus / claim / subscribeToRoom always have a valid mapping.
  const { data: allRequests } = await supabase
    .from("requests")
    .select("id, reference")
    .eq("archived", false);

  const activeRequestIds = (allRequests ?? []).map((r) => r.id);
  const rowIds = rows.map((r) => r.id);
  const allRequestIds = Array.from(new Set([...activeRequestIds, ...rowIds]));
  
  const { data: allRooms } = await supabase
    .from("chat_rooms")
    .select("id, request_id")
    .in("request_id", allRequestIds.length ? allRequestIds : ["00000000-0000-0000-0000-000000000000"]);

  // Build reference → { requestId (DB UUID), chatRoomId } map from batch results.
  const roomByRequestId: Record<string, string> = {};
  for (const room of allRooms ?? []) roomByRequestId[room.request_id] = room.id;

  const requests: TeamRequest[] = [];
  const messages: TeamMessage[] = [];
  const documents: TeamDocument[] = [];
  const rooms: LiveTeamSnapshot["rooms"] = {};

  // Build rooms map for ALL active requests AND fetched requests
  const allReqs = [...(allRequests ?? []), ...rows];
  for (const r of allReqs) {
    const reference = r.reference || r.id;
    const roomInfo = { requestId: r.id, chatRoomId: roomByRequestId[r.id] ?? null };
    rooms[reference] = roomInfo;
    rooms[r.id] = roomInfo;
  }

  const tBatchStart = Date.now();
  console.log(`[PERF][HYDRATION] T5: loadTeamSnapshot starting batch queries for ${rows.length} requests`);

  // 1. Map requests synchronously
  for (const row of rows) {
    requests.push(mapTeamRequest(row, memberId, names[row.user_id] ?? "User", roomByRequestId[row.id] ?? null));
  }

  const chatRoomIds = rows
    .map((r) => roomByRequestId[r.id])
    .filter((id): id is string => Boolean(id));

  const docsPromise = (rowIds.length || userIds.length)
    ? (rowIds.length && userIds.length)
      ? supabase
          .from("documents")
          .select("*")
          .or(`request_id.in.(${rowIds.join(",")}),uploaded_by.in.(${userIds.join(",")})`)
          .order("created_at", { ascending: false })
          .limit(400)
      : rowIds.length
        ? supabase
            .from("documents")
            .select("*")
            .in("request_id", rowIds)
            .order("created_at", { ascending: false })
            .limit(400)
        : supabase
            .from("documents")
            .select("*")
            .in("uploaded_by", userIds)
            .order("created_at", { ascending: false })
            .limit(400)
    : Promise.resolve({ data: [] });

  // 2. Fetch messages, documents, and notifications in a single parallel batch
  const [messagesResult, docsResult, notes] = await Promise.all([
    chatRoomIds.length
      ? supabase
          .from("messages")
          .select("*, attachment:documents(*)")
          .in("chat_room_id", chatRoomIds)
          .order("created_at", { ascending: true })
          .limit(300)
      : Promise.resolve({ data: [] }),
    docsPromise,
    notificationsApi.listNotifications(30),
  ]);

  console.log(`[PERF][HYDRATION] T6: loadTeamSnapshot batched data resolved in ${Date.now() - tBatchStart}ms`);

  // Build chatRoomId -> reference map for quick mapping
  const chatRoomToRef: Record<string, string> = {};
  for (const r of allReqs) {
    const chatRoomId = roomByRequestId[r.id];
    if (chatRoomId) {
      chatRoomToRef[chatRoomId] = r.reference || r.id;
    }
  }

  for (const m of (messagesResult as any).data ?? []) {
    const reference = chatRoomToRef[m.chat_room_id] || m.chat_room_id;
    messages.push(mapTeamMessage(m, reference, memberName));
  }

  for (const d of (docsResult as any).data ?? []) {
    const req = map.get(d.request_id);
    const reference = req ? (req.reference || req.id) : (d.request_id || "Vault Document");
    documents.push(mapTeamDocument(d, reference));
  }
  return {
    requests,
    requestsHasMore: (count ?? 0) > limit,
    messages,
    documents,
    notifications: notes.map((n) =>
      mapTeamNotification(
        n,
        Object.fromEntries(Object.entries(rooms).map(([ref, r]) => [r.requestId, ref])),
      ),
    ),
    rooms,
    refByRequestId: Object.fromEntries(Object.entries(rooms).map(([ref, r]) => [r.requestId, ref])),
  };
}
