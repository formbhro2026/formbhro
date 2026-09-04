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
  useRef,
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
  acceptCall: (
    targetRoomId?: string,
    callType?: "audio" | "video" | "screen",
    sessionSid?: string,
  ) => Promise<void>;
  hangup: (errorMessage?: string) => Promise<void>;
  switchCamera?: () => Promise<void>;
  activeRoomId: string | undefined;
  setActiveRoomId: (roomId: string | undefined) => void;
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
    callSessionId?: string;
  } | null>(null);

  // Sync if activeRequest changes and no active call is ongoing
  useEffect(() => {
    if (activeRequest?.id && !callRoomId && !incomingAlert) {
      setCallRoomId(activeRequest.id);
    }
  }, [activeRequest?.id, callRoomId, incomingAlert]);

  // Session-level deduplication for incoming call presentation (Fix 1)
  // Tracks callSessionId -> timestamp to prevent duplicate alerts from Realtime notifications and WebRTC offers
  const lastHandledCallSessionIdRef = useRef<Map<string, number>>(new Map());
  // Track answered call sessions separately so bridge answers aren't blocked by incoming alert dedup
  const answeredCallSessionsRef = useRef<Set<string>>(new Set());

  const isCallSessionAlreadyHandled = useCallback(
    (sid?: string): boolean => {
      if (!sid) return false;
      // If currently displaying an incoming alert for this exact session, it is already handled
      if (incomingAlert?.callSessionId === sid) return true;
      // If handled within the last 10 seconds, suppress duplicate presentation
      const lastHandledAt = lastHandledCallSessionIdRef.current.get(sid);
      if (lastHandledAt && Date.now() - lastHandledAt < 10000) {
        return true;
      }
      return false;
    },
    [incomingAlert?.callSessionId],
  );

  const markCallSessionHandled = useCallback((sid?: string) => {
    if (!sid) return;
    lastHandledCallSessionIdRef.current.set(sid, Date.now());
    // Prune entries older than 30s to prevent unbounded memory growth
    const now = Date.now();
    for (const [key, timestamp] of lastHandledCallSessionIdRef.current.entries()) {
      if (now - timestamp > 30000) {
        lastHandledCallSessionIdRef.current.delete(key);
      }
    }
  }, []);

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
            const sid = (notif as any).call_session_id;
            if (sid && isCallSessionAlreadyHandled(sid)) {
              console.log("[GlobalCall] Skipping already handled call session from notification:", sid);
              return;
            }
            if (sid) {
              markCallSessionHandled(sid);
            }

            console.log(
              "[GlobalCall] Incoming call notification received for request:",
              notif.request_id,
              "session:",
              sid,
            );
            const callType: "audio" | "video" = notif.title?.toLowerCase().includes("video")
              ? "video"
              : "audio";

            console.log(
              `[CALL FORENSIC] role=TEAM event=INCOMING_ALERT_SET callSessionId=${sid} requestId=${notif.request_id} source=supabase_notifications timestamp=${Date.now()}`,
            );
            setIncomingAlert({
              requestId: notif.request_id,
              callType,
              title: notif.title,
              callSessionId: sid,
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
  }, [userId, isCallSessionAlreadyHandled, markCallSessionHandled]);

  // Listen for remote offer signal from WebRTC (Fix 2: prevent duplicate presentation if already handled)
  useEffect(() => {
    const onRemoteOffer = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sid = detail?.callSessionId || detail?.sessionId;
      if (!sid) return;

      if (isCallSessionAlreadyHandled(sid)) {
        console.log("[GlobalCall] Skipping duplicate incoming offer for session:", sid);
        return;
      }

      // If already active in call (and not in incoming state), do not show incoming alert
      if (call.session.isActive && !call.session.isIncoming) {
        return;
      }

      markCallSessionHandled(sid);

      console.log("[GlobalCall] Incoming offer received from WebRTC for session:", sid);
      const callType: "audio" | "video" = detail.callType === "video" ? "video" : "audio";
      setIncomingAlert({
        requestId: detail.requestId || callRoomId || "",
        callType,
        title: detail.callerName || (callType === "video" ? "Incoming Video Call" : "Incoming Voice Call"),
        callSessionId: sid,
      });
      if (detail.requestId && detail.requestId !== callRoomId) {
        setCallRoomId(detail.requestId);
      }
      startIncomingCallRingtone();
    };

    window.addEventListener("formbhro:remote_offer", onRemoteOffer);
    return () => {
      window.removeEventListener("formbhro:remote_offer", onRemoteOffer);
    };
  }, [
    call.session.isActive,
    call.session.isIncoming,
    callRoomId,
    isCallSessionAlreadyHandled,
    markCallSessionHandled,
  ]);

  // When WebRTC call ends or becomes inactive, ensure incomingAlert is cleared immediately
  const prevWasActiveRef = useRef(false);
  useEffect(() => {
    const wasActive = prevWasActiveRef.current;
    const isNowActive = call.session.isActive || call.session.isIncoming;
    prevWasActiveRef.current = isNowActive;

    // Only clear incoming alert if the WebRTC session was previously active/incoming and has now ended
    if (wasActive && !isNowActive && incomingAlert) {
      console.log("[GlobalCall] Auto-clearing incoming alert because WebRTC session ended");
      stopIncomingCallRingtone();
      setIncomingAlert(null);
    }
  }, [call.session.isActive, call.session.isIncoming, incomingAlert]);

  // Listen for remote hangup signal dispatched by use-webrtc-call for session-safe alert teardown (Fix 4)
  useEffect(() => {
    const onRemoteHangup = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const remoteSessionId = detail?.sessionId || detail?.callSessionId;

      // Only dismiss the incoming alert/ringtone when session matches (or neither has session ID)
      const matchesSession =
        (incomingAlert?.callSessionId && remoteSessionId && incomingAlert.callSessionId === remoteSessionId) ||
        (!incomingAlert?.callSessionId && !remoteSessionId);

      if (matchesSession) {
        console.log(
          "[GlobalCall] Remote hangup received for matching session, clearing alert and stopping ringtone:",
          remoteSessionId,
        );
        stopIncomingCallRingtone();
        setIncomingAlert(null);
        if (remoteSessionId) {
          lastHandledCallSessionIdRef.current.delete(remoteSessionId);
        }
      } else {
        console.log(
          "[GlobalCall] Ignoring remote hangup for non-matching session. Current:",
          incomingAlert?.callSessionId,
          "Received:",
          remoteSessionId,
        );
      }
    };

    window.addEventListener("formbhro:remote_hangup", onRemoteHangup);
    return () => {
      window.removeEventListener("formbhro:remote_hangup", onRemoteHangup);
    };
  }, [incomingAlert?.callSessionId]);

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
      await call.startCall(type, target);
    },
    [activeRequest?.id, callRoomId, call],
  );

  const handleAcceptCall = useCallback(
    async (
      targetRoomId?: string,
      callType?: "audio" | "video" | "screen",
      sessionSid?: string,
    ) => {
      stopIncomingCallRingtone();
      const effectiveType = callType || incomingAlert?.callType || "audio";
      if (incomingAlert) {
        console.log(
          `[CALL FORENSIC] role=TEAM event=INCOMING_ALERT_CLEARED callSessionId=${incomingAlert.callSessionId || sessionSid || "none"} timestamp=${Date.now()}`,
        );
      }
      setIncomingAlert(null);
      const target = targetRoomId || callRoomId;
      if (target && target !== callRoomId) {
        setCallRoomId(target);
      }
      await call.acceptCall(target, effectiveType, sessionSid);
    },
    [call, callRoomId, incomingAlert],
  );

  // Native Android incoming call answer bridge:
  // When IncomingCallActivity launches/resumes MainActivity with autoAnswer=true,
  // MainActivity triggers 'formbhro:call_answered' and sets window.__FORMBHARO_PENDING_CALL_ANSWER__.
  useEffect(() => {
    const consumePending = () => {
      if (typeof window === "undefined") return;

      let pending = (window as any).__FORMBHARO_PENDING_CALL_ANSWER__;

      if (!pending && (window as any).FormbharoNativeBridge?.getPendingCallAnswer) {
        try {
          const raw = (window as any).FormbharoNativeBridge.getPendingCallAnswer();
          if (raw && raw.trim().length > 0) {
            pending = JSON.parse(raw);
          }
        } catch (e) {
          console.warn("[CALL][BRIDGE] Error reading FormbharoNativeBridge:", e);
        }
      }

      if (pending && pending.autoAnswer) {
        delete (window as any).__FORMBHARO_PENDING_CALL_ANSWER__;
        try {
          (window as any).FormbharoNativeBridge?.clearPendingCallAnswer?.();
        } catch {}

        const sid = pending.callSessionId;
        if (sid && answeredCallSessionsRef.current.has(sid)) {
          console.log("[CALL][BRIDGE] Skipping already answered call session:", sid);
          return;
        }
        if (sid) answeredCallSessionsRef.current.add(sid);
        console.log("[CALL][BRIDGE] Consuming pending call answer from native intent/bridge:", pending);
        const target = pending.requestId || pending.chatRoomId;
        const callType = pending.callType === "video" ? "video" : "audio";
        console.log(
          `[CALL FORENSIC] role=TEAM event=REACT_INCOMING_CALL_EVENT callSessionId=${sid} requestId=${target} timestamp=${Date.now()}`,
        );
        void handleAcceptCall(target, callType, sid);
      }
    };

    consumePending();
    const pollInterval = setInterval(consumePending, 400);
    const stopPollTimer = setTimeout(() => clearInterval(pollInterval), 8000);

    const onCallAnswered = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const sid = detail.callSessionId;
      if (sid && answeredCallSessionsRef.current.has(sid)) {
        console.log("[CALL][BRIDGE] Skipping duplicate formbhro:call_answered for session:", sid);
        return;
      }
      if (sid) answeredCallSessionsRef.current.add(sid);
      console.log("[CALL][BRIDGE] Received formbhro:call_answered event:", detail);
      const target = detail.requestId || detail.chatRoomId;
      const callType = detail.callType === "video" ? "video" : "audio";
      console.log(
        `[CALL FORENSIC] role=TEAM event=REACT_INCOMING_CALL_EVENT callSessionId=${sid} requestId=${target} timestamp=${Date.now()}`,
      );
      void handleAcceptCall(target, callType, sid);
    };

    window.addEventListener("formbhro:call_answered", onCallAnswered);
    return () => {
      clearInterval(pollInterval);
      clearTimeout(stopPollTimer);
      window.removeEventListener("formbhro:call_answered", onCallAnswered);
    };
  }, [handleAcceptCall]);

  const handleHangup = useCallback(
    async (errorMessage?: string) => {
      stopIncomingCallRingtone();
      const currentSid = incomingAlert?.callSessionId;
      setIncomingAlert(null);
      if (currentSid) {
        lastHandledCallSessionIdRef.current.delete(currentSid);
      }
      await call.hangup(errorMessage);
    },
    [call, incomingAlert?.callSessionId],
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

  const handleAcceptFromOverlay = useCallback(() => {
    const target = incomingAlert?.requestId || callRoomId;
    const callType = incomingAlert?.callType || "audio";
    const sid = incomingAlert?.callSessionId;
    console.log(
      "[CALL][BRIDGE] handleAcceptFromOverlay: target=",
      target,
      "callType=",
      callType,
      "sid=",
      sid,
    );
    void handleAcceptCall(target, callType, sid);
  }, [incomingAlert, callRoomId, handleAcceptCall]);

  return (
    <CallContext.Provider
      value={{
        session: activeSession,
        startCall: handleStartCall,
        acceptCall: handleAcceptCall,
        hangup: handleHangup,
        switchCamera: call.switchCamera,
        activeRoomId: callRoomId,
        setActiveRoomId: setCallRoomId,
      }}
    >
      {children}
      {(activeSession.isActive || Boolean(activeSession.error)) && (
        <CallOverlay
          session={activeSession}
          onAccept={handleAcceptFromOverlay}
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
      setActiveRoomId: () => {},
    };
  }
  return ctx;
}
