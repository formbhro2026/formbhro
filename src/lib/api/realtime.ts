import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { MessageRow, NotificationRow, RequestRow, DocumentRow } from "./types";

/**
 * WhatsApp-style live layer. Every subscriber must be torn down on unmount:
 *   useEffect(() => subscribeToRoom(...), [roomId])
 */

export function subscribeToRoom(
  chatRoomId: string,
  handlers: {
    onMessage?: (message: MessageRow) => void;
    onMessageUpdate?: (message: MessageRow) => void;
    onDocument?: (doc: DocumentRow) => void;
    onTyping?: (payload: { userId: string; name: string; typing: boolean }) => void;
  },
) {
  const topic = `room:${chatRoomId}`;

  // Clean up any existing channel with the same topic before creating/subscribing anew
  const existing = supabase.getChannels().find(
    (c) => c.topic === `realtime:${topic}` || c.topic === topic,
  );
  if (existing) {
    void supabase.removeChannel(existing);
  }

  const channel: RealtimeChannel = supabase
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_room_id=eq.${chatRoomId}`,
      },
      (payload) => handlers.onMessage?.(payload.new as MessageRow),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `chat_room_id=eq.${chatRoomId}`,
      },
      (payload) => handlers.onMessageUpdate?.(payload.new as MessageRow),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "documents",
        filter: `chat_room_id=eq.${chatRoomId}`,
      },
      (payload) => handlers.onDocument?.(payload.new as DocumentRow),
    )
    .on("broadcast", { event: "typing" }, ({ payload }) =>
      handlers.onTyping?.(payload as { userId: string; name: string; typing: boolean }),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Broadcast a typing indicator to the other side of a chat room. */
export function sendTyping(
  chatRoomId: string,
  payload: { userId: string; name: string; typing: boolean },
) {
  const topic = `room:${chatRoomId}`;
  const channel =
    supabase.getChannels().find((c) => c.topic === `realtime:${topic}` || c.topic === topic) ??
    supabase.channel(topic);

  return channel.send({ type: "broadcast", event: "typing", payload });
}

export function subscribeToMyNotifications(userId: string, onInsert: (n: NotificationRow) => void) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => onInsert(payload.new as NotificationRow),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Live status / assignment badges. RLS decides which rows actually arrive. */
export function subscribeToRequests(onChange: (request: RequestRow) => void) {
  const channel = supabase
    .channel("requests-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, (payload) => {
      if (payload.new) onChange(payload.new as RequestRow);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToMyDocuments(userId: string, onInsert: (doc: DocumentRow) => void) {
  const channel = supabase
    .channel(`user-docs:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "documents", filter: `uploaded_by=eq.${userId}` },
      (payload) => onInsert(payload.new as DocumentRow),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
