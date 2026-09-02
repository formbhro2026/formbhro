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
    // 1. Try optimal audio constraints
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
      // 2. Fallback to basic audio
      return await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
    }
  } else {
    // Video call
    // 1. Try optimal HD video constraints
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
        // 2. Fallback to simple facingMode
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        });
      } catch {
        // 3. Fallback to basic video & audio
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const myIdRef = useRef<string | null>(null);
  const lastOfferRef = useRef<{ offer: RTCSessionDescriptionInit; type: "audio" | "video" | "screen"; sessionId?: string } | null>(null);
  const offerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callDetailsRef = useRef<ActiveCallDetails | null>(null);

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
      if (event.candidate && chatRoomId && myIdRef.current) {
        sendSignal(chatRoomId, {
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
      const activeId = targetRoomId || chatRoomId;
      if (!activeId) return;

      try {
        cleanup();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        myIdRef.current = user.id;

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
        const callSessionId = "call_" + activeId + "_" + Date.now();
        callDetailsRef.current = {
          callSessionId,
          chatRoomId: activeId,
          requestId: activeId,
          callType: type === "screen" ? "video" : type,
          callerId: user.id,
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

        await sendSignal(activeId, {
          type: "offer",
          from: user.id,
          target: "all",
          data: { offer, type, sessionId: callSessionId },
        });

        // Repeatedly broadcast offer every 2.5 seconds while waiting for answer
        if (offerIntervalRef.current) clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = setInterval(() => {
          if (pcRef.current && lastOfferRef.current && myIdRef.current) {
            void sendSignal(activeId, {
              type: "offer",
              from: myIdRef.current,
              target: "all",
              data: lastOfferRef.current,
            });
          }
        }, 2500);

        // Resolve request UUID, reference, and receiver to trigger reliable call notifications
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeId);
        void supabase
          .from("requests")
          .select("id, user_id, assigned_team_id, reference")
          .or(isUuid ? `id.eq.${activeId}` : `reference.eq.${activeId},id.eq.${activeId}`)
          .maybeSingle()
          .then(async ({ data: reqData }) => {
            const reqUuid = reqData?.id || activeId;
            const reqRef = reqData?.reference || reqData?.id || activeId;
            const receiverId = reqData
              ? user.id === reqData.user_id
                ? reqData.assigned_team_id
                : reqData.user_id
              : undefined;

            if (callDetailsRef.current) {
              callDetailsRef.current.requestId = reqUuid;
              callDetailsRef.current.receiverId = receiverId;
            }
            const isDirectAdminChat =
              reqData?.category === "Team Direct Report" ||
              (reqRef && reqRef.startsWith("ADM-TM"));

            const targetRoute =
              receiverId === reqData?.user_id
                ? `/app/chats/${reqRef}`
                : isDirectAdminChat
                  ? `/team/admin-chat`
                  : `/team/work?r=${reqRef}`;

            if (receiverId) {
              // Direct insert into notifications table to notify active in-app Realtime listeners
              void supabase.from("notifications").insert({
                receiver_id: receiverId,
                role: user.id === reqData?.user_id ? "team" : "user",
                type: "call",
                title: `Incoming ${type === "video" ? "Video" : "Voice"} Call`,
                body: "Tap to answer the call",
                request_id: reqUuid,
                route: targetRoute,
              }).then(({ error: notifErr }) => {
                if (notifErr) console.warn("[Call] Notification insert error:", notifErr.message);
              });
            }

            // Direct FCM push dispatch with high-priority Android & APNs payload
            void supabase.functions
              .invoke("send-fcm-notification", {
                body: {
                  receiver_id: receiverId,
                  notification_type: "call",
                  title: `Incoming ${type === "video" ? "Video" : "Voice"} Call`,
                  body: "Tap to answer the call",
                  request_id: reqUuid,
                  caller_id: user.id,
                  caller_name: (user as any).user_metadata?.full_name || user.email?.split("@")[0] || "Formbhro Support",
                  call_session_id: callSessionId,
                  call_type: type,
                  route: targetRoute,
                },
              })
              .catch((e) => console.warn("[FCM] Call push error:", e));

            // Also call the RPC function for database compatibility
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).rpc("trigger_call_notification", {
                p_request_id: reqUuid,
                p_type: type,
              });
            } catch (rpcErr) {
              console.warn("[FCM] RPC trigger_call_notification error:", rpcErr);
            }
          });

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
    const activeRoomId = targetRoomId || chatRoomId;
    if (!activeRoomId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) myIdRef.current = user.id;

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
          isAccepted: true,
          isIncoming: false,
          localStream: stream,
        }));

        if (myIdRef.current) {
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
      if (chatRoomId && myIdRef.current) {
        await sendSignal(chatRoomId, {
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
    if (!chatRoomId) return;

    let alive = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (alive && user) myIdRef.current = user.id;
    });

    const setupSubscription = () => {
      return subscribeToSignals(chatRoomId, async (signal) => {
        if (!alive || signal.from === myIdRef.current) return;

        switch (signal.type) {
          case "offer": {
            const sid = signal.data.sessionId || ("call_" + chatRoomId + "_" + Date.now());
            if (!callDetailsRef.current || callDetailsRef.current.logged) {
              callDetailsRef.current = {
                callSessionId: sid,
                chatRoomId,
                requestId: chatRoomId,
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
              await sendSignal(chatRoomId, {
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
            if (lastOfferRef.current && myIdRef.current) {
              void sendSignal(chatRoomId, {
                type: "offer",
                from: myIdRef.current,
                target: "all",
                data: lastOfferRef.current,
              });
            }
            break;
          case "answer":
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
  }, [chatRoomId, createPeerConnection, cleanup]);

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
      setSession((prev) => ({
        ...prev,
        facingMode: prev.facingMode === "user" ? "environment" : "user",
      }));
    }
  }, [session.isScreenSharing, session.facingMode]);

  return { session, startCall, acceptCall, hangup, switchCamera };
}
