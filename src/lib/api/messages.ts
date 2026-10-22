import { supabase } from "@/integrations/supabase/client";
import { ApiError, type DocumentRow, type MessageRow, type SenderRole } from "./types";

export type MessageWithDoc = MessageRow & { attachment: DocumentRow | null };

const PAGE_SIZE = 50;

export async function listMessages(
  chatRoomId: string,
  opts?: { limit?: number; before?: string },
): Promise<MessageWithDoc[]> {
  let query = supabase
    .from("messages")
    .select("*, attachment:documents(*)")
    .eq("chat_room_id", chatRoomId)
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? PAGE_SIZE);
  if (opts?.before) query = query.lt("created_at", opts.before);
  const { data, error } = await query;
  if (error) throw new ApiError(error.message, error.code);
  return ((data ?? []) as unknown as MessageWithDoc[]).reverse();
}

export async function sendMessage(input: {
  chatRoomId: string;
  requestId: string;
  body?: string;
  attachmentId?: string;
  replyToId?: string;
  senderRole: SenderRole;
}): Promise<MessageRow> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Session expired. Please sign in again.", "unauthenticated");

  // Resolve request whether input.requestId is a UUID, a reference string (e.g. FRM-...), or chatRoomId
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId);
  let resolvedRequestId = input.requestId;
  let reqData: {
    id: string;
    user_id: string;
    assigned_team_id: string | null;
    reference: string | null;
    category: string | null;
  } | null = null;

  if (isUuid) {
    const { data: r } = await supabase
      .from("requests")
      .select("id, user_id, assigned_team_id, reference, category")
      .eq("id", input.requestId)
      .maybeSingle();
    reqData = r;
    if (r?.id) resolvedRequestId = r.id;
  } else {
    const { data: r } = await supabase
      .from("requests")
      .select("id, user_id, assigned_team_id, reference, category")
      .eq("reference", input.requestId)
      .maybeSingle();
    reqData = r;
    if (r?.id) resolvedRequestId = r.id;
  }

  // Fallback lookup via chat_room_id if reqData still not resolved
  if (!reqData && input.chatRoomId) {
    const { data: roomData } = await supabase
      .from("chat_rooms")
      .select("request_id")
      .eq("id", input.chatRoomId)
      .maybeSingle();
    if (roomData?.request_id) {
      const { data: r } = await supabase
        .from("requests")
        .select("id, user_id, assigned_team_id, reference, category")
        .eq("id", roomData.request_id)
        .maybeSingle();
      reqData = r;
      if (r?.id) resolvedRequestId = r.id;
    }
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_room_id: input.chatRoomId,
      request_id: resolvedRequestId,
      sender_id: uid,
      sender_role: input.senderRole,
      body: input.body ?? null,
      attachment_id: input.attachmentId ?? null,
      reply_to_id: input.replyToId ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("RATE_LIMIT_EXCEEDED")) {
      throw new ApiError("Too many requests. Please try again shortly.", "RATE_LIMIT_EXCEEDED");
    }
    throw new ApiError(error.message, error.code);
  }

  // Dispatch high-priority FCM notification to guarantee instant delivery
  const preview = input.body || "Sent an attachment";
  if (reqData) {
    const isDirectAdminChat = Boolean(
      reqData.category === "Team Direct Report" ||
      (reqData.reference && reqData.reference.startsWith("ADM-TM")),
    );

    const targets: Array<{ receiverId: string; route: string; title: string }> = [];

    if (isDirectAdminChat) {
      if (input.senderRole === "admin") {
        // Admin sent message -> notify Team Member
        const tmId =
          reqData.assigned_team_id ||
          (reqData.user_id !== uid ? reqData.user_id : null);
        if (tmId) {
          targets.push({
            receiverId: tmId,
            route: "/team/admin-chat",
            title: "Admin Support",
          });
        }
      } else {
        // Team Member sent message -> notify Admin
        let adminId =
          reqData.user_id !== reqData.assigned_team_id ? reqData.user_id : null;
        if (!adminId) {
          const { data: adminRole } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin")
            .limit(1)
            .maybeSingle();
          adminId = adminRole?.user_id || null;
        }
        if (adminId) {
          targets.push({
            receiverId: adminId,
            route: `/admin/chats?type=team&teamMember=${reqData.assigned_team_id || reqData.user_id}`,
            title: "Team Member Message",
          });
        }
      }
    } else {
      // Customer request
      const refOrId = reqData.reference || reqData.id;
      if (input.senderRole === "user") {
        // Customer sent message -> notify assigned team member
        if (reqData.assigned_team_id) {
          targets.push({
            receiverId: reqData.assigned_team_id,
            route: `/team/work?r=${refOrId}`,
            title: `New message on ${refOrId}`,
          });
        }
      } else if (input.senderRole === "team") {
        // Team member sent message -> notify customer
        if (reqData.user_id) {
          targets.push({
            receiverId: reqData.user_id,
            route: `/app/chats/${refOrId}`,
            title: `New message on ${refOrId}`,
          });
        }
      } else if (input.senderRole === "admin") {
        // Admin sent message -> notify customer AND assigned team member
        if (reqData.user_id) {
          targets.push({
            receiverId: reqData.user_id,
            route: `/app/chats/${refOrId}`,
            title: `New message from Support`,
          });
        }
        if (reqData.assigned_team_id && reqData.assigned_team_id !== reqData.user_id) {
          targets.push({
            receiverId: reqData.assigned_team_id,
            route: `/team/work?r=${refOrId}`,
            title: `Admin message on ${refOrId}`,
          });
        }
      }
    }

    for (const target of targets) {
      if (!target.receiverId) continue;
      void supabase.functions
        .invoke("send-fcm-notification", {
          body: {
            receiver_id: target.receiverId,
            title: target.title,
            body: preview,
            notification_type: "message",
            request_id: reqData.id,
            chat_room_id: input.chatRoomId,
            route: target.route,
            notification_id: `msg:${data.id}`,
            message_id: data.id,
          },
        })
        .catch((e) => console.warn("[FCM] Direct push invocation error:", e));
    }
  }

  return data;
}

/** Retry wrapper so a transient network failure never loses a message. */
export async function sendMessageWithRetry(
  input: Parameters<typeof sendMessage>[0],
  attempts: number = 3,
): Promise<MessageRow> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await sendMessage(input);
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.code && error.code.startsWith("42")) throw error;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastError instanceof Error ? lastError : new ApiError("Message could not be sent");
}

/** Marks the other party's messages in this room as seen (read receipts). */
export async function markMessagesSeen(chatRoomId: string, myRole: SenderRole) {
  const { error } = await supabase
    .from("messages")
    .update({ seen: true, seen_at: new Date().toISOString() })
    .eq("chat_room_id", chatRoomId)
    .eq("seen", false)
    .neq("sender_role", myRole);
  if (error) throw new ApiError(error.message, error.code);
}

export async function unreadCountForRequest(
  requestId: string,
  myRole: SenderRole,
): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId)
    .eq("seen", false)
    .neq("sender_role", myRole);
  if (error) throw new ApiError(error.message, error.code);
  return count ?? 0;
}

export async function toggleReaction(messageId: string, emoji: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Session expired.", "unauthenticated");

  const { data: message, error: readError } = await supabase
    .from("messages")
    .select("reactions")
    .eq("id", messageId)
    .single();
  if (readError) throw new ApiError(readError.message, readError.code);

  const reactions = { ...((message.reactions ?? {}) as Record<string, string[]>) };
  const current = reactions[emoji] ?? [];
  reactions[emoji] = current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid];
  if (reactions[emoji].length === 0) delete reactions[emoji];

  const { error } = await supabase.from("messages").update({ reactions }).eq("id", messageId);
  if (error) throw new ApiError(error.message, error.code);
  return reactions;
}

export async function recordCallLog(input: {
  chatRoomId: string;
  requestId: string;
  callSessionId: string;
  callType: "audio" | "video";
  status: "completed" | "missed" | "declined" | "cancelled";
  callerId: string;
  receiverId?: string;
  durationSeconds?: number;
}): Promise<string | null> {
  try {
    const { data, error } = await (supabase as any).rpc("record_call_log", {
      p_chat_room_id: input.chatRoomId,
      p_request_id: input.requestId,
      p_call_session_id: input.callSessionId,
      p_call_type: input.callType,
      p_status: input.status,
      p_caller_id: input.callerId,
      p_receiver_id: input.receiverId || null,
      p_duration_seconds: input.durationSeconds || 0,
    });
    if (error) {
      console.warn("[CallLog] record_call_log RPC error:", error.message);
      return null;
    }
    return data as string;
  } catch (err) {
    console.warn("[CallLog] recordCallLog exception:", err);
    return null;
  }
}

export async function deleteChatMessage(messageId: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any).rpc("delete_chat_message", {
      p_message_id: messageId,
    });
    if (!error) return true;
  } catch (_) {}

  // Direct client update fallback if RPC not yet deployed or in offline mode
  const { error } = await supabase
    .from("messages")
    .update({ deleted: true, body: "[Message deleted]" })
    .eq("id", messageId);
  if (error) throw new ApiError(error.message, error.code);
  return true;
}

