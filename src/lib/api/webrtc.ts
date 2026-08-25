import { supabase } from "@/integrations/supabase/client";

export type WebRTCSignal = {
  type: "offer" | "answer" | "candidate" | "hangup";
  from: string;
  target: string;
  data: any;
};

export function sendSignal(chatRoomId: string, signal: WebRTCSignal) {
  return supabase.channel(`webrtc:${chatRoomId}`).send({
    type: "broadcast",
    event: "signal",
    payload: signal,
  });
}

export function subscribeToSignals(
  chatRoomId: string,
  onSignal: (signal: WebRTCSignal) => void
) {
  let retryCount = 0;
  const MAX_RETRIES = 5;
  let channel: any = null;

  const connect = () => {
    channel = supabase
      .channel(`webrtc:${chatRoomId}`)
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        onSignal(payload as WebRTCSignal);
      })
      .subscribe((status) => {
        if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(connect, 1000 * retryCount);
          }
        } else if (status === "SUBSCRIBED") {
          retryCount = 0;
        }
      });
  };

  connect();

  return () => {
    if (channel) void supabase.removeChannel(channel);
  };
}
