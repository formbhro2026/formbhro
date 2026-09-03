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
import { getMyRole } from "./auth";

export type RequestWithRoom = RequestRow & {
  chat_rooms: Pick<ChatRoomRow, "id" | "last_message_at">[];
};

async function requireUid() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (uid) return uid;
  const { data } = await supabase.auth.getUser();
  const fallbackUid = data.user?.id;
  if (!fallbackUid) throw new ApiError("Session expired. Please sign in again.", "unauthenticated");
  return fallbackUid;
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

  const { data, error } = await supabase.rpc("create_new_request_with_limit", {
    p_title: title,
    p_category: input?.category ?? "Government Form",
    p_priority: input?.priority ?? "medium",
  });

  if (error) {
    if (error.message.includes("CHAT_LIMIT_EXCEEDED")) {
      throw new ApiError(
        "You have reached the maximum of 3 chats within 24 hours. Please try again later.",
        "CHAT_LIMIT_EXCEEDED",
      );
    }
    if (error.code === "23505" && error.message.includes("requests_one_active_per_user")) {
      throw new ApiError(
        "You already have an active request. Please wait for it to be completed before starting a new one.",
        "ACTIVE_REQUEST_LIMIT_EXCEEDED",
      );
    }
    if (error.message.includes("RATE_LIMIT_EXCEEDED")) {
      throw new ApiError("Too many requests. Please try again shortly.", "RATE_LIMIT_EXCEEDED");
    }
    if (error.code === "23505" || error.message.includes("23505")) {
      const active = await getActiveRequest();
      if (active) return active;
    }
    throw new ApiError(error.message, error.code);
  }
  if (!data) throw new ApiError("Failed to fetch created request", "FETCH_FAILED");
  return data as RequestRow;
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
  if (!requestId) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);
  let requestUuid = requestId;
  if (!isUuid) {
    const { data: req } = await supabase
      .from("requests")
      .select("id")
      .eq("reference", requestId)
      .maybeSingle();
    if (req?.id) {
      requestUuid = req.id;
    } else {
      return null;
    }
  }

  const { data, error } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("request_id", requestUuid)
    .maybeSingle();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

/**
 * Returns the existing chat room for a request, or creates one if it doesn't exist.
 * This handles requests that were created before the auto-create trigger was in place.
 */
export async function getOrCreateChatRoom(requestId: string): Promise<ChatRoomRow> {
  if (!requestId) throw new ApiError("Invalid request ID", "INVALID_REQUEST_ID");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);
  let requestUuid = requestId;
  if (!isUuid) {
    const { data: req } = await supabase
      .from("requests")
      .select("id")
      .eq("reference", requestId)
      .maybeSingle();
    if (req?.id) {
      requestUuid = req.id;
    }
  }

  const existing = await getChatRoom(requestUuid);
  if (existing) return existing;

  // Chat room missing — call the secure DB function to create it
  const { error } = await supabase.rpc("ensure_chat_room_exists", {
    p_request_id: requestUuid,
  });
  if (error) throw new ApiError(error.message, error.code);

  // Fetch the created room
  const created = await getChatRoom(requestUuid);
  if (!created) throw new ApiError("Failed to create chat room", "ROOM_CREATE_FAILED");
  return created;
}

/** RLS scopes this automatically: own requests for users, assigned for team, all for admin. */
export async function listRequests(opts?: {
  status?: DbRequestStatus[];
  archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RequestRow[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  let query = supabase.from("requests").select("*").order("last_activity_at", { ascending: false });
  
  if (opts?.status?.length) query = query.in("status", opts.status);
  
  if (typeof opts?.archived === "boolean") {
    if (opts.archived === false && uid) {
      query = query.or(`archived.eq.false,and(assigned_team_id.eq.${uid},status.eq.completed)`);
    } else {
      query = query.eq("archived", opts.archived);
    }
  }

  if (opts?.search)
    query = query.or(`title.ilike.%${opts.search}%,reference.ilike.%${opts.search}%`);
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}

/** Returns paginated requests and total count. Admin / Team only due to usage. */
export async function listRequestsPaginated(opts?: {
  status?: DbRequestStatus[];
  archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: RequestRow[]; count: number }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  let query = supabase
    .from("requests")
    .select("*", { count: "exact" })
    .order("last_activity_at", { ascending: false });
    
  if (opts?.status?.length) query = query.in("status", opts.status);
  
  if (typeof opts?.archived === "boolean") {
    if (opts.archived === false && uid) {
      query = query.or(`archived.eq.false,and(assigned_team_id.eq.${uid},status.eq.completed)`);
    } else {
      query = query.eq("archived", opts.archived);
    }
  }

  if (opts?.search)
    query = query.or(`title.ilike.%${opts.search}%,reference.ilike.%${opts.search}%`);
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new ApiError(error.message, error.code);
  return { data: data ?? [], count: count ?? 0 };
}

/** Team & Admin only (enforced by RLS). */
export async function updateRequestStatus(
  requestId: string,
  status: DbRequestStatus,
  progress?: number,
) {
  // Fetch current DB status so we can step through required intermediate
  // transitions enforced by the state machine trigger.
  const { data: current } = await supabase
    .from("requests")
    .select("status")
    .eq("id", requestId)
    .single();

  const currentStatus = current?.status as DbRequestStatus | undefined;

  // State machine only allows: assigned → in_progress → (waiting_documents | under_review | completed)
  // If we're at 'assigned' and need to jump past 'in_progress', step through it first.
  if (
    currentStatus === "assigned" &&
    status !== "assigned" &&
    status !== "in_progress" &&
    status !== "cancelled"
  ) {
    const { error: stepError } = await supabase
      .from("requests")
      .update({ status: "in_progress" })
      .eq("id", requestId);
    if (stepError && !stepError.message.includes("tuple to be updated was already modified")) {
      throw new ApiError(stepError.message, stepError.code);
    }
  }

  // Also handle pending → assigned step if trying to go further
  if (
    currentStatus === "pending" &&
    status !== "pending" &&
    status !== "assigned" &&
    status !== "cancelled"
  ) {
    // pending can only go to assigned — skip to assigned first
    const { error: stepError } = await supabase
      .from("requests")
      .update({ status: "assigned" })
      .eq("id", requestId);
    if (stepError && !stepError.message.includes("tuple to be updated was already modified")) {
      throw new ApiError(stepError.message, stepError.code);
    }
    // Then step to in_progress if needed
    if (status !== "in_progress") {
      const { error: step2Error } = await supabase
        .from("requests")
        .update({ status: "in_progress" })
        .eq("id", requestId);
      if (step2Error && !step2Error.message.includes("tuple to be updated was already modified")) {
        throw new ApiError(step2Error.message, step2Error.code);
      }
    }
  }

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

export async function getTeamAnalytics() {
  const uid = await requireUid();
  // RLS enforces that only authorized team/admin users can query/count assigned requests
  const [assignedRes, completedRes] = await Promise.all([
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("assigned_team_id", uid),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("assigned_team_id", uid)
      .eq("status", "completed"),
  ]);

  const assigned = assignedRes.count ?? 0;
  const completed = completedRes.count ?? 0;
  const pending = assigned - completed;

  return {
    assigned,
    completed,
    pending: Math.max(0, pending),
  };
}

export async function transferRequest(requestId: string, newAssigneeId: string): Promise<void> {
  const uid = await requireUid();
  const role = await getMyRole();
  if (role !== "team" && role !== "admin") {
    throw new ApiError("Unauthorized", "unauthorized");
  }

  const { error } = await supabase.rpc("transfer_request", {
    req_id: requestId,
    new_assignee_id: newAssigneeId,
  });

  if (error) {
    throw new ApiError(error.message, error.code);
  }
}

export async function getActiveTeamMembers(): Promise<{ id: string; name: string }[]> {
  const uid = await requireUid();
  // Fetch active team members with their profiles
  const { data, error } = await supabase
    .from("team_members")
    .select("id, is_active, profiles!inner(full_name, email)")
    .eq("is_active", true)
    .neq("id", uid); // don't include self

  if (error) {
    throw new ApiError(error.message, error.code);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.profiles.full_name || row.profiles.email.split("@")[0] || "Team Member",
  }));
}

// ─── Phase 6C: Escalation ─────────────────────────────────────────────────────

/** Escalate a request to Admin. Caller must be the currently assigned Team Member. */
export async function escalateRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("escalate_request", { req_id: requestId });
  if (error) throw new ApiError(error.message, error.code);
}

/** Clear the escalation flag without triggering a full takeover. */
export async function deEscalateRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("de_escalate_request", { req_id: requestId });
  if (error) throw new ApiError(error.message, error.code);
}

/** Updates the tags on a request (Team/Admin chat tagging) */
export async function updateRequestTags(requestId: string, tags: string[]): Promise<void> {
  // 1. Try invoking the secure RPC
  try {
    const { error: rpcErr } = await (supabase as any).rpc("update_request_tags", {
      p_request_id: requestId,
      p_tags: tags,
    });
    if (!rpcErr) return;
  } catch (err) {
    console.warn("[Requests] update_request_tags RPC error, falling back to direct update:", err);
  }

  // 2. Fallback to direct update
  const { error } = await (supabase as any)
    .from("requests")
    .update({ tags })
    .eq("id", requestId);
  if (error) throw new ApiError(error.message, error.code);
}
