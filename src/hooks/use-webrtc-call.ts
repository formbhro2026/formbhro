import { useEffect, useRef, useState, useCallback } from "react";
import { subscribeToSignals, sendSignal, type WebRTCSignal } from "@/lib/api/webrtc";
import { supabase } from "@/integrations/supabase/client";
import { isCapacitor } from "@/lib/fcm";
import { startIncomingCallRingtone, stopIncomingCallRingtone } from "@/lib/audio-notifications";
import { recordCallLog } from "@/lib/api/messages";

export type CallSession = {
  isActive: boolean;
  isIncoming: boolean;
  isOutgoing: boolean;
  isAccepted: boolean;
  isScreenSharing: boolean;
  callType: "audio" | "video" | "screen" | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  error: string | null;
  facingMode: "user" | "environment";
};

interface ActiveCallDetails {
  callSessionId: string;
  chatRoomId: string;
  requestId: string;
  callType: "audio" | "video";
  callerId: string;
  receiverId?: string;
  connectedAt?: number;
  status: "completed" | "missed" | "declined" | "cancelled";
  isCaller: boolean;
  logged: boolean;
}

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

export interface ResolvedCallRoom {
  canonicalRoomId: string;
  requestUuid: string;
  requestReference?: string;
  requestUserId?: string;
  chatRoomId?: string;
  receiverId?: string;
  targetRoute?: string;
  isDirectAdminChat?: boolean;
}

const canonicalRoomCache = new Map<string, ResolvedCallRoom>();

export async function resolveCanonicalCallRoom(
  rawId: string,
  currentUserId?: string,
): Promise<ResolvedCallRoom> {
  if (!rawId) return { canonicalRoomId: "", requestUuid: "" };

  const cached = canonicalRoomCache.get(rawId);
  if (cached && (!currentUserId || cached.receiverId !== undefined)) {
    return cached;
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

  try {
    const { data: reqData } = await supabase
      .from("requests")
      .select("id, user_id, assigned_team_id, reference, category")
      .or(isUuid ? `id.eq.${rawId}` : `reference.eq.${rawId},id.eq.${rawId}`)
      .maybeSingle();

    if (reqData) {
      const isDirectAdminChat = Boolean(
        reqData.category === "Team Direct Report" ||
        (reqData.reference && reqData.reference.startsWith("ADM-TM")),
      );

      const receiverId = currentUserId
        ? currentUserId === reqData.user_id
          ? (reqData.assigned_team_id ?? undefined)
          : (reqData.user_id ?? undefined)
        : undefined;

      const targetRoute =
        receiverId === reqData.user_id
          ? `/app/chats/${reqData.reference || reqData.id}`
          : isDirectAdminChat
            ? `/team/admin-chat`
            : `/team/work?r=${reqData.reference || reqData.id}`;

      const resolved: ResolvedCallRoom = {
        canonicalRoomId: reqData.id,
        requestUuid: reqData.id,
        requestReference: reqData.reference ?? undefined,
        requestUserId: reqData.user_id,
        receiverId,
        targetRoute,
        isDirectAdminChat,
      };

      canonicalRoomCache.set(rawId, resolved);
      canonicalRoomCache.set(reqData.id, resolved);
      if (reqData.reference) canonicalRoomCache.set(reqData.reference, resolved);
      return resolved;
    }

    if (isUuid) {
      // If not in requests table directly, check if it is a chat_room ID
      const { data: roomData } = await supabase
        .from("chat_rooms")
        .select("id, request_id")
        .eq("id", rawId)
        .maybeSingle();
      if (roomData?.request_id) {
        return resolveCanonicalCallRoom(roomData.request_id, currentUserId);
      }
    }
  } catch (err) {
    console.warn("[CALL][SIGNAL] Room resolution error:", err);
  }

  // Fallback
  const fallback: ResolvedCallRoom = {
    canonicalRoomId: rawId,
    requestUuid: rawId,
  };
  canonicalRoomCache.set(rawId, fallback);
  return fallback;
}

const requestMediaPermissions = async (
  type: "audio" | "video" | "screen" = "video",
  facingMode: "user" | "environment" = "user",
): Promise<MediaStream> => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Media devices are not supported in this browser/device.");
  }

  if (type === "screen") {
    if (isCapacitor() || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error("Screen sharing is not supported on mobile devices.");
    }

    try {
      return await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } as any,
        audio: true,
      });
    } catch (displayErr) {
      console.warn("Screen share with audio failed, trying without audio:", displayErr);
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } as any,
        audio: false,
      });

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
          screenStream.addTrack(audioTrack);
        }
      } catch (audioErr) {
        console.warn("Could not add microphone audio to screen share:", audioErr);
      }

      return screenStream;
    }
  } else if (type === "audio") {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (audioConstrainedErr) {
      console.warn(
        "Constrained audio getUserMedia failed, retrying with basic audio: true:",
        audioConstrainedErr,
      );
      return await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
    }
  } else {
    // Video call
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: facingMode,
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (videoConstrainedErr) {
      console.warn(
        "Constrained video getUserMedia failed, retrying with simple video/audio:",
        videoConstrainedErr,
      );
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }
    }
  }
};

export function useWebRTCCall(chatRoomId: string | undefined) {
  const [session, setSession] = useState<CallSession>({
    isActive: false,
    isIncoming: false,
    isOutgoing: false,
    isAccepted: false,
    isScreenSharing: false,
    callType: null,
    remoteStream: null,
    localStream: null,
    error: null,
    facingMode: "user",
  });

  const [canonicalRoomId, setCanonicalRoomId] = useState<string | undefined>(undefined);
  const canonicalRoomIdRef = useRef<string | undefined>(undefined);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const myIdRef = useRef<string | null>(null);
  const lastOfferRef = useRef<{
    offer: RTCSessionDescriptionInit;
    type: "audio" | "video" | "screen";
    sessionId?: string;
  } | null>(null);
  const offerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noAnswerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalSessionsRef = useRef<Set<string>>(new Set());
  const callDetailsRef = useRef<ActiveCallDetails | null>(null);

  // Sync current user ID eagerly & via auth change
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (authSession?.user?.id) {
        myIdRef.current = authSession.user.id;
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      myIdRef.current = authSession?.user?.id ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  // Ensure all call timers and ringtones stop on unmount
  useEffect(() => {
    return () => {
      if (offerIntervalRef.current) {
        clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = null;
      }
      if (noAnswerTimeoutRef.current) {
        clearTimeout(noAnswerTimeoutRef.current);
        noAnswerTimeoutRef.current = null;
      }
      stopIncomingCallRingtone();
    };
  }, []);

  // Keep canonicalRoomId synced when chatRoomId changes
  useEffect(() => {
    if (!chatRoomId) {
      setCanonicalRoomId(undefined);
      canonicalRoomIdRef.current = undefined;
      return;
    }

    let active = true;
    void resolveCanonicalCallRoom(chatRoomId).then((res) => {
      if (active && res.canonicalRoomId) {
        setCanonicalRoomId(res.canonicalRoomId);
        canonicalRoomIdRef.current = res.canonicalRoomId;
      }
    });

    return () => {
      active = false;
    };
  }, [chatRoomId]);

  const finalizeCallLog = useCallback((errorMessage?: string) => {
    const details = callDetailsRef.current;
    if (!details || details.logged) return;
    details.logged = true;

    let finalStatus: "completed" | "missed" | "declined" | "cancelled" = details.status;
    let durationSeconds = 0;

    if (details.connectedAt) {
      finalStatus = "completed";
      durationSeconds = Math.max(1, Math.round((Date.now() - details.connectedAt) / 1000));
    } else if (errorMessage?.includes("No answer") || details.status === "missed") {
      finalStatus = "missed";
    } else if (details.status === "declined") {
      finalStatus = "declined";
    } else {
      finalStatus = "cancelled";
    }

    if (details.chatRoomId && details.requestId && details.callerId) {
      void recordCallLog({
        chatRoomId: details.chatRoomId,
        requestId: details.requestId,
        callSessionId: details.callSessionId,
        callType: details.callType,
        status: finalStatus,
        callerId: details.callerId,
        receiverId: details.receiverId,
        durationSeconds,
      });
    }
  }, []);

  const cleanup = useCallback(
    (errorMessage?: string) => {
      const currentSid = callDetailsRef.current?.callSessionId;
      if (currentSid) {
        terminalSessionsRef.current.add(currentSid);
        console.log(
          `[CALL][TRACE][CLEANUP] Marked callSessionId=${currentSid} as terminal. timestamp=${Date.now()}`,
        );
      }

      finalizeCallLog(errorMessage);
      stopIncomingCallRingtone();

      if (offerIntervalRef.current) {
        clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = null;
      }
      if (noAnswerTimeoutRef.current) {
        clearTimeout(noAnswerTimeoutRef.current);
        noAnswerTimeoutRef.current = null;
      }
      lastOfferRef.current = null;

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setSession({
        isActive: false,
        isIncoming: false,
        isOutgoing: false,
        isAccepted: false,
        isScreenSharing: false,
        callType: null,
        remoteStream: null,
        localStream: null,
        error: errorMessage || null,
        facingMode: "user",
      });
    },
    [finalizeCallLog],
  );

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      const activeRoom = canonicalRoomIdRef.current || chatRoomId;
      if (event.candidate && activeRoom && myIdRef.current) {
        void sendSignal(activeRoom, {
          type: "candidate",
          from: myIdRef.current,
          target: "all",
          data: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setSession((prev) => ({ ...prev, remoteStream: event.streams[0] }));
      } else {
        setSession((prev) => {
          const currentRemote = prev.remoteStream || new MediaStream();
          currentRemote.addTrack(event.track);
          return { ...prev, remoteStream: currentRemote };
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        cleanup();
      }
    };

    return pc;
  }, [chatRoomId, cleanup]);

  const startCall = useCallback(
    async (type: "audio" | "video" | "screen" = "video", targetRoomId?: string) => {
      const rawId = targetRoomId || chatRoomId;
      if (!rawId) return;

      try {
        cleanup();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        myIdRef.current = user.id;

        // 1. Resolve canonical signaling room ID BEFORE creating offer or subscribing
        const resolved = await resolveCanonicalCallRoom(rawId, user.id);
        const canonicalRoom = resolved.canonicalRoomId;
        canonicalRoomIdRef.current = canonicalRoom;
        setCanonicalRoomId(canonicalRoom);

        let stream: MediaStream;
        try {
          stream = await requestMediaPermissions(type);
        } catch (mediaErr: any) {
          console.error("Media permissions error:", mediaErr);
          const errName = mediaErr?.name || "";
          let errorMessage = isCapacitor()
            ? "Microphone and camera permissions are required. Please enable them in app settings."
            : "Microphone and camera access is required for calls.";

          if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
            errorMessage =
              "Permission denied. Please allow microphone and camera access in your browser or device settings.";
          } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
            errorMessage = "No microphone or camera was detected on this device.";
          } else if (errName === "NotReadableError" || errName === "TrackStartError") {
            errorMessage = "Microphone/Camera is currently in use by another app.";
          }

          setSession((prev) => ({ ...prev, error: errorMessage }));
          return;
        }

        localStreamRef.current = stream;

        // Clear any previous interval or timeout
        if (offerIntervalRef.current) {
          clearInterval(offerIntervalRef.current);
          offerIntervalRef.current = null;
        }
        if (noAnswerTimeoutRef.current) {
          clearTimeout(noAnswerTimeoutRef.current);
          noAnswerTimeoutRef.current = null;
        }

        // Generate callSessionId EXACTLY ONCE
        const callSessionId = "call_" + canonicalRoom + "_" + Date.now();
        console.log(
          `[CALL][TRACE][START] callSessionId=${callSessionId} requestId=${resolved.requestUuid} canonicalRoomId=${canonicalRoom} userId=${user.id} timestamp=${Date.now()} source=startCall`,
        );

        callDetailsRef.current = {
          callSessionId,
          chatRoomId: canonicalRoom,
          requestId: resolved.requestUuid,
          callType: type === "screen" ? "video" : type,
          callerId: user.id,
          receiverId: resolved.receiverId,
          status: "cancelled",
          isCaller: true,
          logged: false,
        };

        setSession((prev) => ({
          ...prev,
          isActive: true,
          isOutgoing: true,
          isScreenSharing: type === "screen",
          callType: type,
          localStream: stream,
        }));

        const pc = createPeerConnection();
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        lastOfferRef.current = { offer, type, sessionId: callSessionId };

        console.log(
          `[CALL][TRACE][OFFER] Sending offer: callSessionId=${callSessionId} requestId=${resolved.requestUuid} canonicalRoomId=${canonicalRoom} userId=${user.id} timestamp=${Date.now()} source=startCall`,
        );
        await sendSignal(canonicalRoom, {
          type: "offer",
          from: user.id,
          target: "all",
          data: { offer, type, sessionId: callSessionId, requestId: resolved.requestUuid },
        });

        // Broadcast offer every 2.5 seconds until answered or terminal
        offerIntervalRef.current = setInterval(() => {
          if (terminalSessionsRef.current.has(callSessionId)) {
            if (offerIntervalRef.current) {
              clearInterval(offerIntervalRef.current);
              offerIntervalRef.current = null;
            }
            return;
          }
          if (pcRef.current && lastOfferRef.current && myIdRef.current) {
            console.log(
              `[CALL][TRACE][OFFER] (Retry broadcast) callSessionId=${callSessionId} canonicalRoomId=${canonicalRoom} timestamp=${Date.now()} source=offerInterval`,
            );
            void sendSignal(canonicalRoom, {
              type: "offer",
              from: myIdRef.current,
              target: "all",
              data: lastOfferRef.current,
            });
          }
        }, 2500);

        // Dispatches single authoritative FCM notification + database notification
        const callerName =
          (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Formbhro Support";
        console.log(
          `[CALL][TRACE][NOTIFICATION] Invoking send-fcm-notification: callSessionId=${callSessionId} receiver=${resolved.receiverId} req=${resolved.requestUuid} timestamp=${Date.now()}`,
        );

        void supabase.functions
          .invoke("send-fcm-notification", {
            body: {
              receiver_id: resolved.receiverId,
              notification_type: "call",
              is_support_call: Boolean(user.id === resolved.requestUserId || !resolved.receiverId),
              title: `Incoming ${type === "video" ? "Video" : "Voice"} Call`,
              body: "Tap to answer the call",
              request_id: resolved.requestUuid,
              caller_id: user.id,
              caller_name: callerName,
              call_session_id: callSessionId,
              call_type: type,
              route: resolved.targetRoute,
            },
          })
          .then(({ data, error }) => {
            if (error) {
              console.warn("[CALL][FCM] send-fcm-notification error:", error);
            } else {
              console.log("[CALL][FCM] send-fcm-notification dispatched successfully:", data);
            }
          })
          .catch((e) => console.warn("[CALL][FCM] Call push network error:", e));

        // Auto hangup after 30 seconds if not accepted (safe lifecycle cancellation)
        noAnswerTimeoutRef.current = setTimeout(() => {
          if (terminalSessionsRef.current.has(callSessionId)) return;
          setSession((currentSession) => {
            if (
              currentSession.isActive &&
              currentSession.isOutgoing &&
              !currentSession.isAccepted
            ) {
              console.log(
                `[CALL][TRACE][HANGUP] Auto-hangup (no answer timeout): callSessionId=${callSessionId} timestamp=${Date.now()}`,
              );
              hangup("No answer from the other side.");
              return currentSession;
            }
            return currentSession;
          });
        }, 30000);
      } catch (err) {
        console.error("WebRTC startCall error:", err);
        setSession((prev) => ({
          ...prev,
          error: "Could not start call: " + (err as Error).message,
        }));
      }
    },
    [chatRoomId, cleanup, createPeerConnection],
  );

  const acceptCall = useCallback(
    async (targetRoomId?: string) => {
      stopIncomingCallRingtone();
      const rawId = targetRoomId || canonicalRoomIdRef.current || chatRoomId;
      if (!rawId) return;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) myIdRef.current = user.id;

        const resolved = await resolveCanonicalCallRoom(rawId, user?.id);
        const activeRoomId = resolved.canonicalRoomId;
        canonicalRoomIdRef.current = activeRoomId;
        setCanonicalRoomId(activeRoomId);

        const sid = callDetailsRef.current?.callSessionId || "call_" + activeRoomId;
        console.log(
          `[CALL][TRACE][ACCEPT] Accepting call: callSessionId=${sid} canonicalRoomId=${activeRoomId} userId=${user?.id} timestamp=${Date.now()}`,
        );

        let stream: MediaStream;
        try {
          stream = await requestMediaPermissions(session.callType || "video");
        } catch (mediaErr: any) {
          console.error("Media permissions error:", mediaErr);
          const errName = mediaErr?.name || "";
          let errorMessage = isCapacitor()
            ? "Microphone and camera permissions are required. Please enable them in app settings."
            : "Microphone and camera access is required for calls.";

          if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
            errorMessage =
              "Permission denied. Please allow microphone and camera access in your browser or device settings.";
          } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
            errorMessage = "No microphone or camera was detected on this device.";
          } else if (errName === "NotReadableError" || errName === "TrackStartError") {
            errorMessage = "Microphone/Camera is currently in use by another app.";
          }

          setSession((prev) => ({ ...prev, error: errorMessage }));
          return;
        }

        localStreamRef.current = stream;

        let pc = pcRef.current;
        if (!pc) {
          pc = createPeerConnection();
          pcRef.current = pc;
        }

        stream.getTracks().forEach((track) => pc?.addTrack(track, stream));

        if (callDetailsRef.current) {
          callDetailsRef.current.status = "completed";
          callDetailsRef.current.connectedAt = Date.now();
        }

        // Check if remote offer was already received
        if (pc.remoteDescription) {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          setSession((prev) => ({
            ...prev,
            isActive: true,
            isAccepted: true,
            isIncoming: false,
            localStream: stream,
          }));

          if (myIdRef.current) {
            console.log(
              `[CALL][TRACE][ANSWER] Sending answer: callSessionId=${sid} canonicalRoomId=${activeRoomId} timestamp=${Date.now()}`,
            );
            await sendSignal(activeRoomId, {
              type: "answer",
              from: myIdRef.current,
              target: "all",
              data: { ...answer, sessionId: sid },
            });
          }
        } else {
          // Request offer from caller if remote description not yet set
          setSession((prev) => ({
            ...prev,
            isAccepted: true,
            isIncoming: false,
            localStream: stream,
          }));

          if (myIdRef.current) {
            console.log(
              `[CALL][TRACE][REQUEST_OFFER] Requesting offer: callSessionId=${sid} canonicalRoomId=${activeRoomId} timestamp=${Date.now()}`,
            );
            await sendSignal(activeRoomId, {
              type: "request_offer",
              from: myIdRef.current,
              target: "all",
              data: { sessionId: sid },
            });
          }
        }
      } catch (err) {
        console.error("WebRTC acceptCall error:", err);
        setSession((prev) => ({
          ...prev,
          error: "Could not accept call: " + (err as Error).message,
        }));
      }
    },
    [chatRoomId, session.callType, createPeerConnection],
  );

  const hangup = useCallback(
    async (errorMessage?: string) => {
      const currentSid = callDetailsRef.current?.callSessionId;
      if (currentSid) {
        terminalSessionsRef.current.add(currentSid);
        console.log(
          `[CALL][TRACE][HANGUP] Hangup initiated for callSessionId=${currentSid} timestamp=${Date.now()}`,
        );
      }

      stopIncomingCallRingtone();
      if (offerIntervalRef.current) {
        clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = null;
      }
      if (noAnswerTimeoutRef.current) {
        clearTimeout(noAnswerTimeoutRef.current);
        noAnswerTimeoutRef.current = null;
      }
      const activeRoom = canonicalRoomIdRef.current || chatRoomId;
      if (activeRoom && myIdRef.current) {
        console.log(
          `[CALL][TRACE][HANGUP] Sending hangup signal: callSessionId=${currentSid} canonicalRoomId=${activeRoom} timestamp=${Date.now()}`,
        );
        await sendSignal(activeRoom, {
          type: "hangup",
          from: myIdRef.current,
          target: "all",
          data: { sessionId: currentSid },
        });
      }
      cleanup(typeof errorMessage === "string" ? errorMessage : undefined);
    },
    [chatRoomId, cleanup],
  );

  useEffect(() => {
    const activeSignalingRoom = canonicalRoomId || chatRoomId;
    if (!activeSignalingRoom) return;

    let alive = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (alive && user) myIdRef.current = user.id;
    });

    console.log(
      `[CALL][SIGNAL] Subscribing to WebRTC signals on channel: webrtc:${activeSignalingRoom}`,
    );

    const setupSubscription = () => {
      return subscribeToSignals(activeSignalingRoom, async (signal) => {
        if (!alive) return;

        // 1. Synchronously drop self-broadcasted signals
        const currentUserId =
          myIdRef.current || (await supabase.auth.getSession()).data.session?.user?.id;
        if (currentUserId && !myIdRef.current) myIdRef.current = currentUserId;

        if (signal.from && currentUserId && signal.from === currentUserId) {
          return;
        }

        const sid = signal.data?.sessionId || signal.data?.callSessionId;

        console.log(
          `[CALL][TRACE][RECEIVED_SIGNAL] type=${signal.type} callSessionId=${sid} from=${signal.from} canonicalRoomId=${activeSignalingRoom} timestamp=${Date.now()}`,
        );

        // 2. Drop any signal belonging to a terminal/ended call session
        if (sid && terminalSessionsRef.current.has(sid)) {
          console.log(
            `[CALL][TRACE][IGNORE_TERMINAL] Dropping stale signal for terminal callSessionId=${sid} type=${signal.type}`,
          );
          return;
        }

        switch (signal.type) {
          case "offer": {
            if (!sid) {
              console.warn(
                "[CALL][SIGNAL] Offer missing sessionId, ignoring to prevent phantom calls",
              );
              return;
            }

            // Drop offer if this session was already terminated
            if (terminalSessionsRef.current.has(sid)) {
              console.log(`[CALL][TRACE][OFFER] Ignoring stale offer for terminal session: ${sid}`);
              return;
            }

            // Drop offer if we are already connected to an ongoing call
            if (
              callDetailsRef.current &&
              callDetailsRef.current.callSessionId !== sid &&
              callDetailsRef.current.status === "completed"
            ) {
              console.log(`[CALL][TRACE][OFFER] Dropping offer: another call is currently active`);
              return;
            }

            console.log(
              `[CALL][TRACE][OFFER] Processing incoming offer: callSessionId=${sid} from=${signal.from} timestamp=${Date.now()}`,
            );

            if (!callDetailsRef.current || callDetailsRef.current.logged) {
              callDetailsRef.current = {
                callSessionId: sid,
                chatRoomId: activeSignalingRoom,
                requestId: signal.data.requestId || activeSignalingRoom,
                callType: signal.data.type === "screen" ? "video" : signal.data.type || "video",
                callerId: signal.from,
                status: "declined",
                isCaller: false,
                logged: false,
              };
            }

            let pc = pcRef.current;
            if (!pc) {
              pc = createPeerConnection();
              pcRef.current = pc;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data.offer));

            // If user already clicked accept, answer immediately
            if (localStreamRef.current && myIdRef.current) {
              if (callDetailsRef.current) {
                callDetailsRef.current.status = "completed";
                callDetailsRef.current.connectedAt = Date.now();
              }
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              console.log(
                `[CALL][TRACE][ANSWER] Sending immediate answer: callSessionId=${sid} canonicalRoomId=${activeSignalingRoom} timestamp=${Date.now()}`,
              );
              await sendSignal(activeSignalingRoom, {
                type: "answer",
                from: myIdRef.current,
                target: "all",
                data: { ...answer, sessionId: sid },
              });
              setSession((prev) => ({
                ...prev,
                isActive: true,
                isAccepted: true,
                isIncoming: false,
                callType: signal.data.type || "video",
              }));
            } else {
              startIncomingCallRingtone();
              setSession((prev) => ({
                ...prev,
                isActive: true,
                isIncoming: true,
                isScreenSharing: signal.data.type === "screen",
                callType: signal.data.type || (signal.data.isScreenShare ? "screen" : "video"),
              }));
            }
            break;
          }
          case "request_offer":
            console.log(
              `[CALL][TRACE][REQUEST_OFFER] Received request_offer on: ${activeSignalingRoom} session=${sid}`,
            );
            // Only retransmit if this outgoing call is active and NOT terminal
            if (lastOfferRef.current && myIdRef.current) {
              const offerSid = lastOfferRef.current.sessionId;
              if (offerSid && terminalSessionsRef.current.has(offerSid)) {
                console.log(
                  `[CALL][TRACE][REQUEST_OFFER] Dropping request_offer: session ${offerSid} is terminal`,
                );
                return;
              }
              console.log(
                `[CALL][TRACE][OFFER] (Retransmitting offer on request) session=${offerSid}`,
              );
              void sendSignal(activeSignalingRoom, {
                type: "offer",
                from: myIdRef.current,
                target: "all",
                data: lastOfferRef.current,
              });
            }
            break;
          case "answer":
            console.log(
              `[CALL][TRACE][ANSWER] Received answer on: ${activeSignalingRoom} session=${sid}`,
            );
            if (offerIntervalRef.current) {
              clearInterval(offerIntervalRef.current);
              offerIntervalRef.current = null;
            }
            if (noAnswerTimeoutRef.current) {
              clearTimeout(noAnswerTimeoutRef.current);
              noAnswerTimeoutRef.current = null;
            }
            if (callDetailsRef.current) {
              callDetailsRef.current.status = "completed";
              callDetailsRef.current.connectedAt = Date.now();
            }
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
              setSession((prev) => ({ ...prev, isAccepted: true, isOutgoing: false }));
            }
            break;
          case "candidate":
            if (pcRef.current) {
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.data));
              } catch (e) {
                console.error("Error adding ice candidate", e);
              }
            }
            break;
          case "hangup":
            console.log(
              `[CALL][TRACE][HANGUP] Received remote hangup on: ${activeSignalingRoom} session=${sid}`,
            );
            if (sid) {
              terminalSessionsRef.current.add(sid);
            }
            cleanup();
            break;
        }
      });
    };

    const unsubscribe = setupSubscription();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [canonicalRoomId, chatRoomId, createPeerConnection, cleanup]);

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current || session.isScreenSharing) return;

    try {
      const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (!currentVideoTrack) return;

      const newFacingMode = session.facingMode === "user" ? "environment" : "user";
      setSession((prev) => ({ ...prev, facingMode: newFacingMode }));

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: newFacingMode,
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      localStreamRef.current.removeTrack(currentVideoTrack);
      localStreamRef.current.addTrack(newVideoTrack);
      currentVideoTrack.stop();

      const updatedStream = new MediaStream(localStreamRef.current.getTracks());
      localStreamRef.current = updatedStream;
      setSession((prev) => ({ ...prev, localStream: updatedStream }));
    } catch (err) {
      console.error("Could not switch camera:", err);
    }
  }, [session.facingMode, session.isScreenSharing]);

  return {
    session,
    startCall,
    acceptCall,
    hangup,
    switchCamera,
    canonicalRoomId,
  };
}
