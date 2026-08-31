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

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_room_id: input.chatRoomId,
      request_id: input.requestId,
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
  void supabase
    .from("requests")
    .select("user_id, assigned_team_id")
    .eq("id", input.requestId)
    .single()
    .then(({ data: reqData }) => {
      if (!reqData) return;
      const receiverId = input.senderRole === "user" ? reqData.assigned_team_id : reqData.user_id;
      if (!receiverId) return;

      void supabase.functions
        .invoke("send-fcm-notification", {
          body: {
            receiver_id: receiverId,
            title: "New message",
            body: preview,
            notification_type: "message",
            request_id: input.requestId,
            chat_room_id: input.chatRoomId,
            route: `/app/chats/${input.requestId}`,
          },
        })
        .catch((e) => console.warn("[FCM] Direct push invocation error:", e));
    });

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
