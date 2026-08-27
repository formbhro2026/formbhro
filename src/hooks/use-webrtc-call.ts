import { useEffect, useRef, useState, useCallback } from "react";
import { subscribeToSignals, sendSignal, type WebRTCSignal } from "@/lib/api/webrtc";
import { supabase } from "@/integrations/supabase/client";
import { isCapacitor } from "@/lib/fcm";

export type CallSession = {
  isActive: boolean;
  isIncoming: boolean;
  isOutgoing: boolean;
  isAccepted: boolean;
  isScreenSharing: boolean;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  error: string | null;
};

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

const requestMediaPermissions = async (screenShare = false): Promise<MediaStream> => {
  if (screenShare) {
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
      // Fallback: try screen share without audio, then add microphone separately
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } as any,
        audio: false,
      });

      // Add microphone audio separately
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
  } else {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
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
    remoteStream: null,
    localStream: null,
    error: null,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const myIdRef = useRef<string | null>(null);

  const cleanup = useCallback((errorMessage?: string) => {
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
      remoteStream: null,
      localStream: null,
      error: errorMessage || null,
    });
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && chatRoomId && myIdRef.current) {
        sendSignal(chatRoomId, {
          type: "candidate",
          from: myIdRef.current,
          target: "all", // Simplified for 1:1
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
    async (screenShare = false) => {
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
          stream = await requestMediaPermissions(screenShare);
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
          isScreenSharing: screenShare,
          localStream: stream,
        }));

        const pc = createPeerConnection();
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await sendSignal(chatRoomId, {
          type: "offer",
          from: user.id,
          target: "all",
          data: { offer, isScreenShare: screenShare },
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

  const acceptCall = useCallback(async () => {
    if (!pcRef.current || !chatRoomId || !myIdRef.current) return;

    try {
      let stream: MediaStream;
      try {
        stream = await requestMediaPermissions(false);
      } catch (mediaErr) {
        console.error("Media permissions error:", mediaErr);
        const errorMessage = isCapacitor()
          ? "Camera and microphone permissions are required. Please enable them in app settings."
          : "Camera and microphone access is required for video calls.";
        setSession((prev) => ({ ...prev, error: errorMessage }));
        return;
      }

      localStreamRef.current = stream;

      stream.getTracks().forEach((track) => pcRef.current?.addTrack(track, stream));

      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);

      setSession((prev) => ({
        ...prev,
        isAccepted: true,
        isIncoming: false,
        localStream: stream,
      }));

      await sendSignal(chatRoomId, {
        type: "answer",
        from: myIdRef.current,
        target: "all",
        data: answer,
      });
    } catch (err) {
      console.error("WebRTC acceptCall error:", err);
      setSession((prev) => ({
        ...prev,
        error: "Could not accept call: " + (err as Error).message,
      }));
    }
  }, [chatRoomId]);

  const hangup = useCallback(
    async (errorMessage?: string) => {
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
    const retryCount = 0;
    const MAX_RETRIES = 3;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (alive && user) myIdRef.current = user.id;
    });

    const setupSubscription = () => {
      return subscribeToSignals(chatRoomId, async (signal) => {
        if (!alive || signal.from === myIdRef.current) return;

        switch (signal.type) {
          case "offer":
            if (!pcRef.current) {
              setSession((prev) => ({
                ...prev,
                isActive: true,
                isIncoming: true,
                isScreenSharing: signal.data.isScreenShare,
              }));
              const pc = createPeerConnection();
              pcRef.current = pc;
              await pc.setRemoteDescription(new RTCSessionDescription(signal.data.offer));
            }
            break;
          case "answer":
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

    // Health check for signaling channel
    const checkInterval = setInterval(() => {
      if (alive && chatRoomId) {
        // Simple presence or retry logic could go here if Supabase channel state was exposed
      }
    }, 10000);

    return () => {
      alive = false;
      clearInterval(checkInterval);
      unsubscribe();
    };
  }, [chatRoomId, createPeerConnection, cleanup]);

  return { session, startCall, acceptCall, hangup };
}
