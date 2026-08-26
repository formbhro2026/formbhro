import { supabase } from "@/integrations/supabase/client";
import {
  ACTIVE_DB_STATUSES,
  ApiError,
  type ActivityLogRow,
  type ChatRoomRow,
  type DbRequestPriority,
  type DbRequestStatus,
  type RequestRow,
  type StatusHistoryRow,
} from "./types";

export type RequestWithRoom = RequestRow & {
  chat_rooms: Pick<ChatRoomRow, "id" | "last_message_at">[];
};

async function requireUid() {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new ApiError("Session expired. Please sign in again.", "unauthenticated");
  return uid;
}

/** Returns the user's single active (non-completed, non-cancelled) request, if any. */
export async function getActiveRequest(): Promise<RequestRow | null> {
  const uid = await requireUid();
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("user_id", uid)
    .in("status", ACTIVE_DB_STATUSES)
    .maybeSingle();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

/**
 * Creates a brand new request / chat session for the authenticated user.
 */
export async function createNewRequest(input?: {
  title?: string;
  category?: string;
  priority?: DbRequestPriority;
}): Promise<RequestRow> {
  const uid = await requireUid();
  const title = input?.title?.trim() || "Form Assistance";
  const { data, error } = await supabase
    .from("requests")
    .insert({
      user_id: uid,
      title,
      category: input?.category ?? "Government Form",
      priority: input?.priority ?? "medium",
      reference: `FRM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const active = await getActiveRequest();
      if (active) return active;
    }
    throw new ApiError(error.message, error.code);
  }
  return data;
}

/**
 * Entry point to either create or return active request.
 */
export async function createOrContinueRequest(input: {
  title: string;
  category?: string;
  priority?: DbRequestPriority;
}): Promise<{ request: RequestRow; created: boolean }> {
  const existing = await getActiveRequest();
  if (existing) return { request: existing, created: false };

  const request = await createNewRequest(input);
  return { request, created: true };
}

export async function getRequest(requestId: string): Promise<RequestRow | null> {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function getChatRoom(requestId: string): Promise<ChatRoomRow | null> {
  const { data, error } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

/** RLS scopes this automatically: own requests for users, assigned for team, all for admin. */
export async function listRequests(opts?: {
  status?: DbRequestStatus[];
  archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RequestRow[]> {
  let query = supabase.from("requests").select("*").order("last_activity_at", { ascending: false });
  if (opts?.status?.length) query = query.in("status", opts.status);
  if (typeof opts?.archived === "boolean") query = query.eq("archived", opts.archived);
  if (opts?.search)
    query = query.or(`title.ilike.%${opts.search}%,reference.ilike.%${opts.search}%`);
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}

/** Team & Admin only (enforced by RLS). */
export async function updateRequestStatus(
  requestId: string,
  status: DbRequestStatus,
  progress?: number,
) {
  const patch = typeof progress === "number" ? { status, progress } : { status };
  let { data, error } = await supabase
    .from("requests")
    .update(patch)
    .eq("id", requestId)
    .select()
    .single();

  if (error && error.message.includes("tuple to be updated was already modified")) {
    // Retry once if it was a transient trigger conflict
    const retry = await supabase
      .from("requests")
      .update(patch)
      .eq("id", requestId)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function markRequestCompleted(requestId: string) {
  return updateRequestStatus(requestId, "completed", 100);
}

/** Admin only (RLS blocks team members from assigning). */
export async function assignRequest(requestId: string, teamMemberId: string) {
  const { data, error } = await supabase
    .from("requests")
    .update({
      assigned_team_id: teamMemberId,
      assigned_at: new Date().toISOString(),
      status: "assigned",
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function getRequestTimeline(requestId: string): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}

export async function getStatusHistory(requestId: string): Promise<StatusHistoryRow[]> {
  const { data, error } = await supabase
    .from("request_status_history")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}
