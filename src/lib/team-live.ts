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
): TeamRequest {
  return {
    id: row.reference || row.id,
    title: row.title,
    category: row.category ?? "Government Form",
    userName,
    userInitials: initialsOf(userName),
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
    author: mine ? "team" : "user",
    authorName: mine ? memberName : "User",
    time: timeLabel(row.created_at),
    text: row.body ?? undefined,
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

  // Merge and deduplicate
  const map = new Map<string, RequestRow>();
  for (const r of poolRows ?? []) map.set(r.id, r);
  for (const r of myRequests ?? []) map.set(r.id, r);
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
    rooms[reference] = { requestId: r.id, chatRoomId: roomByRequestId[r.id] ?? null };
  }

  for (const row of rows) {
    const reference = row.reference || row.id;
    requests.push(mapTeamRequest(row, memberId, names[row.user_id] ?? "User"));
    // Room already in map from batch fetch above — just load messages if room exists
    const chatRoomId = roomByRequestId[row.id];
    if (chatRoomId) {
      const list = await messagesApi.listMessages(chatRoomId, { limit: 100 });
      messages.push(...list.map((m) => mapTeamMessage(m, reference, memberName)));
    }
    const docs = await documentsApi.listDocuments({ requestId: row.id, userId: row.user_id });
    documents.push(...docs.map((d) => mapTeamDocument(d, reference)));
  }

  const notes = await notificationsApi.listNotifications(30);
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
