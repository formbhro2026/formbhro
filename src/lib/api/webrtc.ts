import { supabase } from "@/integrations/supabase/client";

export type WebRTCSignal = {
  type: "offer" | "answer" | "candidate" | "hangup" | "request_offer";
  from: string;
  target: string;
  data: any;
};

type ChannelEntry = {
  channel: any;
  status: "CONNECTING" | "SUBSCRIBED" | "CLOSED";
  subscribers: Set<(signal: WebRTCSignal) => void>;
  queue: WebRTCSignal[];
};

const activeChannels = new Map<string, ChannelEntry>();

function getOrCreateChannel(chatRoomId: string): ChannelEntry {
  let entry = activeChannels.get(chatRoomId);
  if (entry) return entry;

  const channel = supabase.channel(`webrtc:${chatRoomId}`, {
    config: { broadcast: { ack: true } },
  });

  entry = {
    channel,
    status: "CONNECTING",
    subscribers: new Set(),
    queue: [],
  };
  activeChannels.set(chatRoomId, entry);

  channel
    .on("broadcast", { event: "signal" }, ({ payload }: { payload: WebRTCSignal }) => {
      entry?.subscribers.forEach((cb) => cb(payload));
    })
    .subscribe((status: string) => {
      if (entry) {
        if (status === "SUBSCRIBED") {
          entry.status = "SUBSCRIBED";
          // Flush any signals queued before the channel connected
          while (entry.queue.length > 0) {
            const nextSignal = entry.queue.shift();
            if (nextSignal) {
              void entry.channel.send({
                type: "broadcast",
                event: "signal",
                payload: nextSignal,
              });
            }
          }
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          entry.status = "CLOSED";
        }
      }
    });

  return entry;
}

export async function sendSignal(chatRoomId: string, signal: WebRTCSignal) {
  const entry = getOrCreateChannel(chatRoomId);

  if (entry.status === "SUBSCRIBED") {
    return entry.channel.send({
      type: "broadcast",
      event: "signal",
      payload: signal,
    });
  }

  // If not yet connected, queue it to send immediately when SUBSCRIBED
  entry.queue.push(signal);
  return { ok: true };
}

export function subscribeToSignals(chatRoomId: string, onSignal: (signal: WebRTCSignal) => void) {
  const entry = getOrCreateChannel(chatRoomId);
  entry.subscribers.add(onSignal);

  return () => {
    entry.subscribers.delete(onSignal);
    if (entry.subscribers.size === 0) {
      void supabase.removeChannel(entry.channel);
      activeChannels.delete(chatRoomId);
    }
  };
}
