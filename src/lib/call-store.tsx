/**
 * src/lib/call-store.tsx
 *
 * Truly Global WebRTC Calling Context.
 * Listens for incoming calls across all application screens (User, Team, Admin)
 * and renders WhatsApp-style incoming call alerts, continuous ringtones, and call overlays.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useWebRTCCall, type CallSession } from "@/hooks/use-webrtc-call";
import { CallOverlay } from "@/components/chat/CallOverlay";
import { UserStoreContext } from "@/lib/user-store-context";
import { supabase } from "@/integrations/supabase/client";
import { startIncomingCallRingtone, stopIncomingCallRingtone } from "@/lib/audio-notifications";

interface GlobalCallContextType {
  session: CallSession;
  startCall: (type?: "audio" | "video" | "screen", targetRoomId?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  hangup: (errorMessage?: string) => Promise<void>;
  switchCamera?: () => Promise<void>;
  activeRoomId: string | undefined;
}

const CallContext = createContext<GlobalCallContextType | null>(null);

export function GlobalCallProvider({ children }: { children: ReactNode }) {
  // Use direct Supabase auth so this works in all shells (user, team, admin)
  // without requiring a SessionProvider ancestor.
  const [userId, setUserId] = useState<string | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? undefined);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? undefined);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userStore = useContext(UserStoreContext);
  const activeRequest = userStore?.activeRequest;

  // Track active call room ID (either explicit active request or incoming call room ID)
  const [callRoomId, setCallRoomId] = useState<string | undefined>(activeRequest?.id);

  // Incoming call alert state for incoming calls from outside the active chat room
  const [incomingAlert, setIncomingAlert] = useState<{
    requestId: string;
    callType: "audio" | "video" | "screen";
    title?: string;
  } | null>(null);

  // Sync if activeRequest changes and no active call is ongoing
  useEffect(() => {
    if (activeRequest?.id && !callRoomId && !incomingAlert) {
      setCallRoomId(activeRequest.id);
    }
  }, [activeRequest?.id, callRoomId, incomingAlert]);

  const call = useWebRTCCall(callRoomId);

  // Listen to incoming call notifications globally for this authenticated user
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`global-calls:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as {
            type?: string;
            request_id?: string;
            title?: string;
            body?: string;
          };

          if (notif.type === "call" && notif.request_id) {
            console.log(
              "[GlobalCall] Incoming call notification received for request:",
              notif.request_id,
            );
            const callType: "audio" | "video" = notif.title?.toLowerCase().includes("video")
              ? "video"
              : "audio";

            setIncomingAlert({
              requestId: notif.request_id,
              callType,
              title: notif.title,
            });
            setCallRoomId(notif.request_id);
            startIncomingCallRingtone();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Auto-dismiss incoming alert after 30 seconds if not answered
  useEffect(() => {
    if (incomingAlert) {
      const timer = setTimeout(() => {
        setIncomingAlert((curr) => {
          if (curr) stopIncomingCallRingtone();
          return null;
        });
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [incomingAlert]);

  const handleStartCall = useCallback(
    async (type: "audio" | "video" | "screen" = "video", targetRoomId?: string) => {
      const target = targetRoomId || activeRequest?.id || callRoomId;
      if (!target) {
        console.warn("[GlobalCall] Cannot start call: No request ID available.");
        return;
      }
      setCallRoomId(target);
      await call.startCall(type);
    },
    [activeRequest?.id, callRoomId, call],
  );

  const handleAcceptCall = useCallback(async () => {
    stopIncomingCallRingtone();
    setIncomingAlert(null);
    await call.acceptCall();
  }, [call]);

  const handleHangup = useCallback(
    async (errorMessage?: string) => {
      stopIncomingCallRingtone();
      setIncomingAlert(null);
      await call.hangup(errorMessage);
    },
    [call],
  );

  // Active session combines WebRTC state and global incoming call alert
  const activeSession: CallSession =
    incomingAlert && !call.session.isActive
      ? {
          isActive: true,
          isIncoming: true,
          isOutgoing: false,
          isAccepted: false,
          isScreenSharing: false,
          callType: incomingAlert.callType,
          remoteStream: null,
          localStream: null,
          error: null,
          facingMode: "user",
        }
      : call.session;

  return (
    <CallContext.Provider
      value={{
        session: activeSession,
        startCall: handleStartCall,
        acceptCall: handleAcceptCall,
        hangup: handleHangup,
        switchCamera: call.switchCamera,
        activeRoomId: callRoomId,
      }}
    >
      {children}
      {activeSession.isActive && (
        <CallOverlay
          session={activeSession}
          onAccept={handleAcceptCall}
          onHangup={handleHangup}
          onSwitchCamera={call.switchCamera}
        />
      )}
    </CallContext.Provider>
  );
}

export function useGlobalCall() {
  const ctx = useContext(CallContext);
  if (!ctx) {
    // Return safe fallback if used outside provider
    return {
      session: {
        isActive: false,
        isIncoming: false,
        isOutgoing: false,
        isAccepted: false,
        isScreenSharing: false,
        callType: null,
        remoteStream: null,
        localStream: null,
        error: null,
        facingMode: "user" as const,
      },
      startCall: async () => {},
      acceptCall: async () => {},
      hangup: async () => {},
      switchCamera: async () => {},
      activeRoomId: undefined,
    };
  }
  return ctx;
}
