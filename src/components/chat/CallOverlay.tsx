import {
  X,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  SwitchCamera,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type CallSession } from "@/hooks/use-webrtc-call";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (localVideoRef.current && session.localStream) {
      localVideoRef.current.srcObject = session.localStream;
    }
  }, [session.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && session.remoteStream && session.callType !== "audio") {
      remoteVideoRef.current.srcObject = session.remoteStream;
      remoteVideoRef.current.play().catch((err) => console.error("Video autoplay failed:", err));
    }
  }, [session.remoteStream, session.callType]);

  useEffect(() => {
    if (audioRef.current && session.remoteStream && session.callType === "audio") {
      audioRef.current.srcObject = session.remoteStream;
      audioRef.current.play().catch((err) => console.error("Audio autoplay failed:", err));
    }
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

  if (!session.isActive && !session.error) return null;

  const isIncomingAlert = session.isIncoming && !session.isAccepted;
  const isStaff =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/team") || window.location.pathname.startsWith("/admin"));

  return (
    <div
      className={cn(
        "fixed z-[100] flex flex-col items-center justify-center bg-black/95 transition-all duration-300 backdrop-blur-xl",
        isMaximized || isIncomingAlert
          ? "inset-0 p-4"
          : "bottom-20 right-4 w-72 h-48 max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden shadow-2xl border border-white/10 sm:w-80 sm:h-52 lg:w-96 lg:h-64",
      )}
    >
      {/* Remote Video (Full Size) */}
      <div className="relative w-full h-full bg-surface-3 rounded-2xl overflow-hidden flex items-center justify-center">
        {!session.isActive && session.error ? (
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="h-16 w-16 rounded-full bg-danger/20 flex items-center justify-center">
              <PhoneOff className="h-8 w-8 text-danger" />
            </div>
            <div>
              <p className="text-white font-bold text-lg mb-2">Call Failed</p>
              <p className="text-sm text-danger-light bg-danger/10 px-4 py-2 rounded-lg border border-danger/20">
                {session.error}
              </p>
            </div>
            <button
              id="call-overlay-error-close"
              onClick={onHangup}
              className="mt-4 px-6 py-2 rounded-full bg-surface-4 text-white hover:bg-surface-5 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : session.remoteStream ? (
          session.callType === "audio" ? (
            <div className="flex flex-col w-full h-full items-center justify-center gap-4 text-center p-6 bg-surface-3">
              <div className="h-24 w-24 rounded-full bg-brand/20 flex items-center justify-center animate-pulse">
                <Phone className="h-10 w-10 text-brand" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">In Call</p>
                <p className="text-sm text-text-muted mt-1">Audio Connected</p>
              </div>
              <audio ref={audioRef} autoPlay />
            </div>
          ) : (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="h-24 w-24 rounded-full bg-brand/20 flex items-center justify-center animate-pulse ring-8 ring-brand/10">
              <Phone className="h-10 w-10 text-brand" />
            </div>
            <div>
              <p className="text-white font-bold text-xl">
                {session.isAccepted
                  ? "Connecting Call..."
                  : session.isIncoming
                    ? "Incoming Call..."
                    : isStaff
                      ? "Calling Client..."
                      : "Calling Support..."}
              </p>
              <p className="text-xs text-brand font-semibold mt-1.5 uppercase tracking-widest">
                {session.isScreenSharing
                  ? "Screen Sharing Session"
                  : session.callType === "audio"
                    ? "Voice Call"
                    : "Voice & Video Call"}
              </p>
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
                    onClick={onAccept}
                    className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-emerald-500 text-white font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-xl shadow-emerald-500/30 cursor-pointer text-sm"
                    title="Accept Call"
                  >
                    <Phone className="h-5 w-5" />
                    <span>Accept Call</span>
                  </button>
                  <button
                    onClick={onHangup}
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
                    onClick={onHangup}
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
