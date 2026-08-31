import { useEffect, useRef, useState, useCallback } from "react";
import { subscribeToSignals, sendSignal, type WebRTCSignal } from "@/lib/api/webrtc";
import { supabase } from "@/integrations/supabase/client";
import { isCapacitor } from "@/lib/fcm";
import { startIncomingCallRingtone, stopIncomingCallRingtone } from "@/lib/audio-notifications";

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

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

const requestMediaPermissions = async (
  type: "audio" | "video" | "screen" = "video",
  facingMode: "user" | "environment" = "user",
): Promise<MediaStream> => {
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
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
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
    return await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } else {
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
  const lastOfferRef = useRef<{ offer: RTCSessionDescriptionInit; type: "audio" | "video" | "screen" } | null>(null);
  const offerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback((errorMessage?: string) => {
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
  }, []);

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
      setSession((prev) => ({ ...prev, remoteStream: event.streams[0] }));
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        cleanup();
      }
    };

    return pc;
  }, [chatRoomId, cleanup]);

  const startCall = useCallback(
    async (type: "audio" | "video" | "screen" = "video") => {
      if (!chatRoomId) return;

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
        } catch (mediaErr) {
          console.error("Media permissions error:", mediaErr);
          const errorMessage = isCapacitor()
            ? "Camera and microphone permissions are required. Please enable them in app settings."
            : "Camera and microphone access is required for video calls.";
          setSession((prev) => ({ ...prev, error: errorMessage }));
          return;
        }

        localStreamRef.current = stream;
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

        lastOfferRef.current = { offer, type };

        await sendSignal(chatRoomId, {
          type: "offer",
          from: user.id,
          target: "all",
          data: { offer, type },
        });

        // Repeatedly broadcast offer every 2.5 seconds while waiting for answer
        if (offerIntervalRef.current) clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = setInterval(() => {
          if (pcRef.current && lastOfferRef.current && myIdRef.current) {
            void sendSignal(chatRoomId, {
              type: "offer",
              from: myIdRef.current,
              target: "all",
              data: lastOfferRef.current,
            });
          }
        }, 2500);

        // Trigger the FCM Push Notification for the incoming call
        // @ts-expect-error trigger_call_notification is not in the generated types yet
        supabase
          .rpc("trigger_call_notification", {
            p_request_id: chatRoomId,
            p_type: type,
          })
          .then(({ error }) => {
            if (error) {
              console.error("Failed to trigger call push notification:", error);
            }
          });

        // Direct FCM push dispatch fallback
        void supabase.functions
          .invoke("send-fcm-notification", {
            body: {
              notification_type: "call",
              title: `Incoming ${type === "video" ? "Video" : "Voice"} Call`,
              body: "Tap to answer the call",
              request_id: chatRoomId,
              route: `/app/chats/${chatRoomId}`,
            },
          })
          .catch((e) => console.warn("[FCM] Call push error:", e));

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

  const acceptCall = useCallback(async () => {
    stopIncomingCallRingtone();
    if (!chatRoomId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) myIdRef.current = user.id;

      let stream: MediaStream;
      try {
        stream = await requestMediaPermissions(session.callType || "video");
      } catch (mediaErr) {
        console.error("Media permissions error:", mediaErr);
        const errorMessage = isCapacitor()
          ? "Camera and microphone permissions are required. Please enable them in app settings."
          : "Camera and microphone access is required for video calls.";
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
          await sendSignal(chatRoomId, {
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
          await sendSignal(chatRoomId, {
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
            let pc = pcRef.current;
            if (!pc) {
              pc = createPeerConnection();
              pcRef.current = pc;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data.offer));

            // If user already clicked accept, answer immediately
            if (localStreamRef.current && myIdRef.current) {
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
