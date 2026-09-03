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
  status: "completed" | "missed" | "declined" | "cancelled" | "connecting";
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
    const query = supabase
      .from("requests")
      .select("id, user_id, assigned_team_id, reference, category");

    const { data: reqData } = isUuid
      ? await query.eq("id", rawId).maybeSingle()
      : await query.eq("reference", rawId).maybeSingle();

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

function getRole(): "USER" | "TEAM" {
  if (typeof window === "undefined") return "USER";
  const path = window.location.pathname;
  return path.startsWith("/team") || path.startsWith("/admin") ? "TEAM" : "USER";
}

function logWebRTC(
  role: "USER" | "TEAM",
  event: string,
  callSessionId?: string,
  chatRoomId?: string,
  pc?: RTCPeerConnection | null,
  extra?: string,
) {
  const sig = pc?.signalingState || "none";
  const ice = pc?.iceConnectionState || "none";
  const conn = pc?.connectionState || "none";
  const gather = pc?.iceGatheringState || "none";
  console.log(
    `[WEBRTC][${role}] event=${event} callSessionId=${callSessionId || "none"} chatRoomId=${chatRoomId || "none"} signalingState=${sig} iceConnectionState=${ice} connectionState=${conn} iceGatheringState=${gather} timestamp=${Date.now()}${extra ? " " + extra : ""}`,
  );
}

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
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

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

    let finalStatus: "completed" | "missed" | "declined" | "cancelled" =
      details.status === "connecting" ? "cancelled" : details.status;
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
      const role = getRole();
      logWebRTC(
        role,
        "CLEANUP",
        currentSid,
        canonicalRoomIdRef.current || chatRoomId,
        pcRef.current,
        `reason=${errorMessage || "user_hangup"}`,
      );

      if (currentSid) {
        terminalSessionsRef.current.add(currentSid);
        console.log(
          `[CALL][TRACE][CLEANUP] Marked callSessionId=${currentSid} as terminal. timestamp=${Date.now()}`,
        );
      }

      finalizeCallLog(errorMessage);
      stopIncomingCallRingtone();
      pendingCandidatesRef.current = [];

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
    [finalizeCallLog, chatRoomId],
  );

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const role = getRole();

    pc.onicecandidate = (event) => {
      const activeRoom = canonicalRoomIdRef.current || chatRoomId;
      if (event.candidate && activeRoom && myIdRef.current) {
        logWebRTC(
          role,
          "ICE_CANDIDATE_SENT",
          callDetailsRef.current?.callSessionId,
          activeRoom,
          pc,
          `candidate=${event.candidate.candidate.substring(0, 30)}...`,
        );
        void sendSignal(activeRoom, {
          type: "candidate",
          from: myIdRef.current,
          target: "all",
          data: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const activeRoom = canonicalRoomIdRef.current || chatRoomId;
      logWebRTC(
        role,
        "REMOTE_TRACK_RECEIVED",
        callDetailsRef.current?.callSessionId,
        activeRoom,
        pc,
        `kind=${event.track?.kind} enabled=${event.track?.enabled} readyState=${event.track?.readyState}`,
      );
      if (event.track?.kind === "audio") {
        logWebRTC(
          role,
          "AUDIO_TRACK_RECEIVED",
          callDetailsRef.current?.callSessionId,
          activeRoom,
          pc,
          `enabled=${event.track.enabled} readyState=${event.track.readyState}`,
        );
      }
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

    pc.onconnectionstatechange = () => {
      const activeRoom = canonicalRoomIdRef.current || chatRoomId;
      logWebRTC(
        role,
        "CONNECTION_STATE_CHANGED",
        callDetailsRef.current?.callSessionId,
        activeRoom,
        pc,
        `connectionState=${pc.connectionState}`,
      );
    };

    pc.oniceconnectionstatechange = () => {
      const activeRoom = canonicalRoomIdRef.current || chatRoomId;
      logWebRTC(
        role,
        "ICE_CONNECTION_STATE_CHANGED",
        callDetailsRef.current?.callSessionId,
        activeRoom,
        pc,
        `iceConnectionState=${pc.iceConnectionState}`,
      );
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        cleanup("peer_connection_failed");
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
        logWebRTC("USER", "OUTGOING_CALL_STARTED", callSessionId, canonicalRoom, pc);
        logWebRTC("USER", "OFFER_CREATED", callSessionId, canonicalRoom, pc);

        console.log(
          `[CALL][TRACE][OFFER] Sending offer: callSessionId=${callSessionId} requestId=${resolved.requestUuid} canonicalRoomId=${canonicalRoom} userId=${user.id} timestamp=${Date.now()} source=startCall`,
        );
        await sendSignal(canonicalRoom, {
          type: "offer",
          from: user.id,
          target: "all",
          data: { offer, type, sessionId: callSessionId, requestId: resolved.requestUuid },
        });
        logWebRTC("USER", "OFFER_SENT", callSessionId, canonicalRoom, pc);

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

        // 45-second timeout for missed call
        noAnswerTimeoutRef.current = setTimeout(() => {
          if (!session.isAccepted) {
            console.log(
              `[CALL][TRACE][TIMEOUT] No answer after 45s: callSessionId=${callSessionId}`,
            );
            cleanup("No answer");
          }
        }, 45000);
      } catch (err) {
        console.error("WebRTC startCall error:", err);
        cleanup("Could not start call: " + (err as Error).message);
      }
    },
    [chatRoomId, cleanup, createPeerConnection, session.isAccepted],
  );

  const acceptCall = useCallback(
    async (
      targetRoomId?: string,
      explicitCallType?: "audio" | "video" | "screen",
      explicitSessionId?: string,
    ) => {
      stopIncomingCallRingtone();
      const rawId = targetRoomId || canonicalRoomIdRef.current || chatRoomId;
      if (!rawId) return;

      const effectiveCallType: "audio" | "video" | "screen" =
        explicitCallType ||
        session.callType ||
        callDetailsRef.current?.callType ||
        "audio";

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) myIdRef.current = user.id;

        const resolved = await resolveCanonicalCallRoom(rawId, user?.id);
        const activeRoomId = resolved.canonicalRoomId;
        canonicalRoomIdRef.current = activeRoomId;
        setCanonicalRoomId(activeRoomId);

        const sid =
          explicitSessionId ||
          callDetailsRef.current?.callSessionId ||
          "call_" + activeRoomId;

        console.log(
          `[CALL][TRACE][ACCEPT] Accepting call: callSessionId=${sid} canonicalRoomId=${activeRoomId} callType=${effectiveCallType} userId=${user?.id} timestamp=${Date.now()}`,
        );
        logWebRTC("TEAM", "ACCEPT_CALL_ENTER", sid, activeRoomId, pcRef.current);

        const sessionType: "audio" | "video" = effectiveCallType === "audio" ? "audio" : "video";

        // Mark session as active immediately so UI overlay remains mounted
        setSession((prev) => ({
          ...prev,
          isActive: true,
          isIncoming: false,
          isAccepted: true,
          callType: sessionType,
          error: null,
        }));

        let stream: MediaStream;
        try {
          logWebRTC("TEAM", "MEDIA_PERMISSION_START", sid, activeRoomId, pcRef.current);
          stream = await requestMediaPermissions(effectiveCallType);
          logWebRTC(
            "TEAM",
            "MEDIA_PERMISSION_SUCCESS",
            sid,
            activeRoomId,
            pcRef.current,
            `audioTracks=${stream.getAudioTracks().length}`,
          );
        } catch (mediaErr: any) {
          console.error("Media permissions error:", mediaErr);
          const errName = mediaErr?.name || "";
          let errorMessage = isCapacitor()
            ? (effectiveCallType === "audio"
                ? "Microphone permission is required. Please enable it in app settings."
                : "Microphone and camera permissions are required. Please enable them in app settings.")
            : "Microphone access is required for calls.";

          if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
            errorMessage =
              "Permission denied. Please allow microphone access in your browser or device settings.";
          } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
            errorMessage = "No microphone was detected on this device.";
          } else if (errName === "NotReadableError" || errName === "TrackStartError") {
            errorMessage = "Microphone is currently in use by another app.";
          }

          setSession((prev) => ({ ...prev, isActive: false, error: errorMessage }));
          return;
        }

        localStreamRef.current = stream;
        logWebRTC("TEAM", "LOCAL_STREAM_CREATED", sid, activeRoomId, pcRef.current);

        let pc = pcRef.current;
        if (!pc) {
          pc = createPeerConnection();
          pcRef.current = pc;
        }

        stream.getTracks().forEach((track) => pc?.addTrack(track, stream));

        if (!callDetailsRef.current) {
          callDetailsRef.current = {
            callSessionId: sid,
            chatRoomId: activeRoomId,
            requestId: resolved.requestUuid || activeRoomId,
            callType: sessionType,
            callerId: resolved.receiverId || "",
            status: "connecting",
            connectedAt: 0,
            isCaller: false,
            logged: false,
          };
        } else {
          callDetailsRef.current.status = "connecting";
        }

        // Check if remote offer was already received
        if (pc.remoteDescription) {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          logWebRTC("TEAM", "ANSWER_CREATED", sid, activeRoomId, pc);

          setSession((prev) => ({
            ...prev,
            isActive: true,
            isAccepted: true,
            isIncoming: false,
            callType: sessionType,
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
            logWebRTC("TEAM", "ANSWER_SENT", sid, activeRoomId, pc);
          }
        } else {
          // Request offer from caller if remote description not yet set, keeping session active
          setSession((prev) => ({
            ...prev,
            isActive: true,
            isAccepted: true,
            isIncoming: false,
            callType: sessionType,
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
            logWebRTC("TEAM", "REQUEST_OFFER_SENT", sid, activeRoomId, pc);
          }
        }
      } catch (err) {
        console.error("WebRTC acceptCall error:", err);
        setSession((prev) => ({
          ...prev,
          isActive: false,
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

            // Only drop if another peer connection is actively connected to a different session
            const isDifferentSession =
              callDetailsRef.current &&
              callDetailsRef.current.callSessionId &&
              sid &&
              callDetailsRef.current.callSessionId !== sid &&
              !callDetailsRef.current.callSessionId.startsWith(sid) &&
              !sid.startsWith(callDetailsRef.current.callSessionId);

            if (isDifferentSession && pcRef.current?.connectionState === "connected") {
              logWebRTC("TEAM", "OFFER_DROPPED_ANOTHER_CALL_CONNECTED", sid, activeSignalingRoom, pcRef.current);
              return;
            }

            if (callDetailsRef.current) {
              callDetailsRef.current.callSessionId = sid;
              callDetailsRef.current.callerId = signal.from;
            }

            logWebRTC("TEAM", "OFFER_RECEIVED", sid, activeSignalingRoom, pcRef.current);

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
            logWebRTC("TEAM", "REMOTE_DESCRIPTION_SET", sid, activeSignalingRoom, pc);

            // Flush pending ICE candidates that arrived before remoteDescription
            while (pendingCandidatesRef.current.length > 0) {
              const cand = pendingCandidatesRef.current.shift();
              if (cand && pcRef.current) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
                  logWebRTC("TEAM", "QUEUED_ICE_CANDIDATE_APPLIED", sid, activeSignalingRoom, pcRef.current);
                } catch (e) {
                  console.error("Error applying queued ice candidate:", e);
                }
              }
            }

            // If user already clicked accept, answer immediately
            if (localStreamRef.current && myIdRef.current) {
              if (callDetailsRef.current) {
                callDetailsRef.current.status = "completed";
                callDetailsRef.current.connectedAt = Date.now();
              }
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              logWebRTC("TEAM", "ANSWER_CREATED", sid, activeSignalingRoom, pc);

              console.log(
                `[CALL][TRACE][ANSWER] Sending immediate answer: callSessionId=${sid} canonicalRoomId=${activeSignalingRoom} timestamp=${Date.now()}`,
              );
              await sendSignal(activeSignalingRoom, {
                type: "answer",
                from: myIdRef.current,
                target: "all",
                data: { ...answer, sessionId: sid },
              });
              logWebRTC("TEAM", "ANSWER_SENT", sid, activeSignalingRoom, pc);

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
            logWebRTC("USER", "REQUEST_OFFER_RECEIVED", sid, activeSignalingRoom, pcRef.current);
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
              logWebRTC("USER", "OFFER_SENT", offerSid, activeSignalingRoom, pcRef.current, "source=request_offer");
            }
            break;
          case "answer":
            logWebRTC("USER", "ANSWER_RECEIVED", sid, activeSignalingRoom, pcRef.current);
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
              logWebRTC("USER", "REMOTE_DESCRIPTION_SET", sid, activeSignalingRoom, pcRef.current);

              // Flush pending ICE candidates that arrived before remoteDescription
              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                if (cand && pcRef.current) {
                  try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
                    logWebRTC("USER", "QUEUED_ICE_CANDIDATE_APPLIED", sid, activeSignalingRoom, pcRef.current);
                  } catch (e) {
                    console.error("Error applying queued ice candidate:", e);
                  }
                }
              }

              setSession((prev) => ({ ...prev, isAccepted: true, isOutgoing: false }));
            }
            break;
          case "candidate": {
            const role = getRole();
            const pc = pcRef.current;
            if (pc) {
              logWebRTC(
                role,
                "ICE_CANDIDATE_RECEIVED",
                sid,
                activeSignalingRoom,
                pc,
                `candidate=${signal.data?.candidate?.substring(0, 30)}...`,
              );
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(signal.data));
                } catch (e) {
                  console.error("Error adding ice candidate", e);
                }
              } else {
                console.log(`[WEBRTC][${role}] Queuing candidate until remoteDescription is set: session=${sid}`);
                pendingCandidatesRef.current.push(signal.data);
              }
            }
            break;
          }
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
