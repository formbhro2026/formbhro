import {
  X,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  SwitchCamera,
  AlertCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type CallSession } from "@/hooks/use-webrtc-call";
import { cn } from "@/lib/utils";

function formatCallError(error: string): string {
  if (!error) return "Call ended";
  const err = error.toLowerCase();
  if (
    err.includes("peer_connection") ||
    err.includes("ice") ||
    err.includes("network") ||
    err.includes("connection")
  ) {
    return "Call disconnected due to unstable network connection. Please check your internet and try again.";
  }
  if (err.includes("no answer")) {
    return "Call unanswered. Please try again later.";
  }
  if (err.includes("permission") || err.includes("notallowed") || err.includes("denied")) {
    return "Microphone or camera permission denied. Please allow access in app settings.";
  }
  return error;
}

export function CallOverlay({
  session,
  onAccept,
  onHangup,
  onSwitchCamera,
}: {
  session: CallSession;
  onAccept: () => void;
  onHangup: () => void;
  onSwitchCamera?: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleHangupImmediate = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.pause();
        remoteVideoRef.current.srcObject = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.pause();
        localVideoRef.current.srcObject = null;
      }
    } catch (_) { }
    onHangup();
  };

  useEffect(() => {
    if (localVideoRef.current && session.localStream) {
      localVideoRef.current.srcObject = session.localStream;
    }
  }, [session.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && session.remoteStream && session.callType !== "audio") {
      remoteVideoRef.current.srcObject = session.remoteStream;
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.volume = 1.0;
      remoteVideoRef.current.play().catch((err) => console.error("Video autoplay failed:", err));
    }
  }, [session.remoteStream, session.callType]);

  useEffect(() => {
    const audioEl = audioRef.current;
    const stream = session.remoteStream;
    if (!audioEl || !stream) return;

    audioEl.srcObject = stream;
    const playAudio = () => {
      audioEl
        .play()
        .then(() => {
          console.log(
            "[WEBRTC][AUDIO] Audio playback started successfully. tracks:",
            stream.getAudioTracks().length,
          );
        })
        .catch((err) => {
          console.warn("[WEBRTC][AUDIO] Audio autoplay blocked, waiting for user gesture:", err);
        });
    };

    playAudio();

    // Listen for late-arriving audio tracks (e.g. video track negotiated first, audio 200ms later)
    stream.onaddtrack = () => {
      console.log("[WEBRTC][AUDIO] Remote track dynamically added, re-invoking play()");
      playAudio();
    };

    // User gesture fallback unlocker for mobile browsers
    const unlockAudio = () => {
      if (audioEl.paused) {
        audioEl.play().catch(() => { });
      }
    };
    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });

    return () => {
      stream.onaddtrack = null;
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, [session.remoteStream, session.callType]);

  useEffect(() => {
    if (!session.isActive && session.error) {
      const timer = setTimeout(() => {
        // Automatically hide the error overlay after 5 seconds if not active
        if (document.getElementById("call-overlay-error-close")) {
          document.getElementById("call-overlay-error-close")?.click();
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [session.isActive, session.error]);

  const isStaff =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/team") || window.location.pathname.startsWith("/admin"));

  const callerDisplayName =
    session.callerName ||
    (session.isIncoming
      ? (isStaff ? "Client" : "Formbhro Support")
      : (isStaff ? "Calling Client..." : "Calling Support..."));

  const callerInitials =
    callerDisplayName
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "FB";

  if (!session.isActive && !session.error) return null;

  return (
    <div
      id="call-overlay"
      className={cn(
        "fixed z-50 transition-all duration-300 shadow-2xl overflow-hidden flex flex-col bg-surface-1 border border-border/80 backdrop-blur-xl",
        isMinimized
          ? "bottom-4 right-4 w-72 h-44 rounded-2xl"
          : isMaximized
            ? "inset-0 w-full h-full rounded-none"
            : "bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 w-auto sm:w-96 max-w-[calc(100vw-2rem)] h-[480px] sm:h-[520px] rounded-3xl",
      )}
    >
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        className="fixed -top-full -left-full h-0 w-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      />
      {/* Visual media stream container */}
      <div className="relative flex-1 bg-surface-base flex items-center justify-center overflow-hidden">
        {session.error ? (
          <div className="flex flex-col items-center gap-3 text-center p-6 bg-red-950/40 w-full h-full justify-center">
            <AlertCircle className="h-12 w-12 text-destructive animate-bounce" />
            <p className="text-white font-semibold text-sm max-w-xs">{formatCallError(session.error)}</p>
            <button
              id="call-overlay-error-close"
              onClick={handleHangupImmediate}
              className="mt-2 text-xs text-text-muted hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : session.remoteStream ? (
          session.callType === "audio" ? (
            <div className="flex flex-col w-full h-full items-center justify-center gap-3 text-center p-6 bg-surface-3">
              <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse ring-8 ring-emerald-500/10 text-emerald-400 font-bold text-2xl shadow-lg border border-emerald-500/40">
                {callerInitials}
              </div>
              <div>
                <p className="text-white font-bold text-xl sm:text-2xl tracking-tight">{callerDisplayName}</p>
                <p className="text-xs text-emerald-400 font-semibold mt-1 uppercase tracking-wider">Voice Call Connected</p>
                {(session.requestTitle || session.requestId) && (
                  <p className="text-[11px] text-text-muted mt-1 max-w-xs truncate font-medium">
                    {session.requestTitle || `Request ${session.requestId}`}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md border border-white/10">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-white truncate max-w-[180px]">{callerDisplayName}</span>
              </div>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-brand/20 flex items-center justify-center animate-pulse ring-8 ring-brand/10 text-white font-bold text-2xl shadow-lg border border-brand/40">
                {callerInitials}
              </div>
              <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-brand text-white shadow-md">
                <Phone className="h-4 w-4" />
              </span>
            </div>
            <div>
              <p className="text-white font-bold text-xl sm:text-2xl tracking-tight">
                {callerDisplayName}
              </p>
              <p className="text-xs text-brand font-semibold mt-1 uppercase tracking-wider">
                {session.isAccepted
                  ? "Connecting Call..."
                  : session.isIncoming
                    ? (session.callType === "video" ? "Incoming Video Call" : "Incoming Voice Call")
                    : isStaff
                      ? "Calling Client..."
                      : "Calling Support..."}
              </p>
              {(session.requestTitle || session.requestId) && (
                <p className="text-[11px] text-text-muted mt-1.5 max-w-xs truncate font-medium">
                  {session.requestTitle || `Request ${session.requestId}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {session.localStream && session.isActive && session.callType !== "audio" && (
          <div className="absolute top-4 right-4 w-24 h-16 rounded-lg overflow-hidden border border-white/20 shadow-lg bg-black sm:w-32 sm:h-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "w-full h-full object-cover",
                session.facingMode === "user" && "mirror",
              )}
            />
          </div>
        )}

        {/* Controls Overlay */}
        {session.isActive && (
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-4">
            {session.error && (
              <p className="text-xs text-danger text-center font-bold bg-danger/10 py-1.5 rounded-lg border border-danger/20">
                {session.error}
              </p>
            )}

            <div className="flex items-center justify-center gap-6">
              {session.isIncoming && !session.isAccepted ? (
                <>
                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.play().catch(() => { });
                      }
                      onAccept();
                    }}
                    className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-emerald-500 text-white font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-xl shadow-emerald-500/30 cursor-pointer text-sm"
                    title="Accept Call"
                  >
                    <Phone className="h-5 w-5" />
                    <span>Accept Call</span>
                  </button>
                  <button
                    onClick={handleHangupImmediate}
                    className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-red-500 text-white font-bold hover:bg-red-600 active:scale-95 transition-all shadow-xl shadow-red-500/30 cursor-pointer text-sm"
                    title="Decline Call"
                  >
                    <PhoneOff className="h-5 w-5" />
                    <span>Decline</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleHangupImmediate}
                    className="h-14 w-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 active:scale-95 transition-all shadow-xl shadow-red-500/30 cursor-pointer"
                    title="End Call"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </button>
                  {onSwitchCamera && !session.isScreenSharing && session.callType !== "audio" && (
                    <button
                      onClick={onSwitchCamera}
                      className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
                      title="Switch Camera"
                    >
                      <SwitchCamera className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
                  >
                    {isMaximized ? (
                      <Minimize2 className="h-5 w-5" />
                    ) : (
                      <Maximize2 className="h-5 w-5" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
