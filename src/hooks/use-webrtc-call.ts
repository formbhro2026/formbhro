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
  chatRoomId?: string;
  receiverId?: string;
  targetRoute?: string;
  isDirectAdminChat?: boolean;
}

const canonicalRoomCache = new Map<string, ResolvedCallRoom>();

export async function resolveCanonicalCallRoom(rawId: string, currentUserId?: string): Promise<ResolvedCallRoom> {
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
      const isDirectAdminChat =
        reqData.category === "Team Direct Report" ||
        (reqData.reference && reqData.reference.startsWith("ADM-TM"));

      const receiverId = currentUserId
        ? currentUserId === reqData.user_id
          ? reqData.assigned_team_id
          : reqData.user_id
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
        requestReference: reqData.reference,
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
      console.warn("Constrained audio getUserMedia failed, retrying with basic audio: true:", audioConstrainedErr);
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
      console.warn("Constrained video getUserMedia failed, retrying with simple video/audio:", videoConstrainedErr);
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
  const lastOfferRef = useRef<{ offer: RTCSessionDescriptionInit; type: "audio" | "video" | "screen"; sessionId?: string } | null>(null);
  const offerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callDetailsRef = useRef<ActiveCallDetails | null>(null);

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

  const cleanup = useCallback((errorMessage?: string) => {
    finalizeCallLog(errorMessage);
    stopIncomingCallRingtone();
    if (offerIntervalRef.current) {
      clearInterval(offerIntervalRef.current);
      offerIntervalRef.current = null;
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
  }, [finalizeCallLog]);

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
            errorMessage = "Permission denied. Please allow microphone and camera access in your browser or device settings.";
          } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
            errorMessage = "No microphone or camera was detected on this device.";
          } else if (errName === "NotReadableError" || errName === "TrackStartError") {
            errorMessage = "Microphone/Camera is currently in use by another app.";
          }

          setSession((prev) => ({ ...prev, error: errorMessage }));
          return;
        }

        localStreamRef.current = stream;

        // Generate callSessionId EXACTLY ONCE
        const callSessionId = "call_" + canonicalRoom + "_" + Date.now();
        console.log(`[CALL][WEBRTC] Starting call: session=${callSessionId} canonicalRoom=${canonicalRoom} req=${resolved.requestUuid} ref=${resolved.requestReference}`);

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

        console.log(`[CALL][SIGNAL] Sending offer on canonical room: ${canonicalRoom}`);
        await sendSignal(canonicalRoom, {
          type: "offer",
          from: user.id,
          target: "all",
          data: { offer, type, sessionId: callSessionId, requestId: resolved.requestUuid },
        });

        // Repeatedly broadcast offer every 2.5 seconds while waiting for answer
        if (offerIntervalRef.current) clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = setInterval(() => {
          if (pcRef.current && lastOfferRef.current && myIdRef.current) {
            void sendSignal(canonicalRoom, {
              type: "offer",
              from: myIdRef.current,
              target: "all",
              data: lastOfferRef.current,
            });
          }
        }, 2500);

        // Dispatches single authoritative FCM notification + database notification
        const callerName = (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Formbhro Support";
        console.log(`[CALL][FCM] Invoking send-fcm-notification: receiver=${resolved.receiverId} req=${resolved.requestUuid} route=${resolved.targetRoute}`);

        void supabase.functions
          .invoke("send-fcm-notification", {
            body: {
              receiver_id: resolved.receiverId,
              notification_type: "call",
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

        // Auto hangup after 30 seconds if not accepted
        setTimeout(() => {
          setSession((currentSession) => {
            if (
              currentSession.isActive &&
              currentSession.isOutgoing &&
              !currentSession.isAccepted
            ) {
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

  const acceptCall = useCallback(async (targetRoomId?: string) => {
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

      console.log(`[CALL][ANSWER] Accepting call on canonical room: ${activeRoomId}`);

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
          errorMessage = "Permission denied. Please allow microphone and camera access in your browser or device settings.";
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
          console.log(`[CALL][SIGNAL] Sending answer on canonical room: ${activeRoomId}`);
          await sendSignal(activeRoomId, {
            type: "answer",
            from: myIdRef.current,
            target: "all",
            data: answer,
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
          console.log(`[CALL][SIGNAL] Requesting offer on canonical room: ${activeRoomId}`);
          await sendSignal(activeRoomId, {
            type: "request_offer",
            from: myIdRef.current,
            target: "all",
            data: null,
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
  }, [chatRoomId, session.callType, createPeerConnection]);

  const hangup = useCallback(
    async (errorMessage?: string) => {
      stopIncomingCallRingtone();
      if (offerIntervalRef.current) {
        clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = null;
      }
      const activeRoom = canonicalRoomIdRef.current || chatRoomId;
      if (activeRoom && myIdRef.current) {
        console.log(`[CALL][HANGUP] Sending hangup on canonical room: ${activeRoom}`);
        await sendSignal(activeRoom, {
          type: "hangup",
          from: myIdRef.current,
          target: "all",
          data: null,
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

    console.log(`[CALL][SIGNAL] Subscribing to WebRTC signals on channel: webrtc:${activeSignalingRoom}`);

    const setupSubscription = () => {
      return subscribeToSignals(activeSignalingRoom, async (signal) => {
        if (!alive || signal.from === myIdRef.current) return;

        switch (signal.type) {
          case "offer": {
            const sid = signal.data.sessionId || ("call_" + activeSignalingRoom + "_" + Date.now());
            console.log(`[CALL][SIGNAL] Received offer: session=${sid} from=${signal.from}`);

            if (!callDetailsRef.current || callDetailsRef.current.logged) {
              callDetailsRef.current = {
                callSessionId: sid,
                chatRoomId: activeSignalingRoom,
                requestId: signal.data.requestId || activeSignalingRoom,
                callType: signal.data.type === "screen" ? "video" : (signal.data.type || "video"),
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

              console.log(`[CALL][SIGNAL] Sending immediate answer on canonical room: ${activeSignalingRoom}`);
              await sendSignal(activeSignalingRoom, {
                type: "answer",
                from: myIdRef.current,
                target: "all",
                data: answer,
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
            console.log(`[CALL][SIGNAL] Received request_offer on: ${activeSignalingRoom}`);
            if (lastOfferRef.current && myIdRef.current) {
              void sendSignal(activeSignalingRoom, {
                type: "offer",
                from: myIdRef.current,
                target: "all",
                data: lastOfferRef.current,
              });
            }
            break;
          case "answer":
            console.log(`[CALL][SIGNAL] Received answer on: ${activeSignalingRoom}`);
            if (offerIntervalRef.current) {
              clearInterval(offerIntervalRef.current);
              offerIntervalRef.current = null;
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
            console.log(`[CALL][HANGUP] Received hangup signal on: ${activeSignalingRoom}`);
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
