import { X, Phone, PhoneOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type CallSession } from "@/hooks/use-webrtc-call";
import { cn } from "@/lib/utils";

export function CallOverlay({
  session,
  onAccept,
  onHangup,
}: {
  session: CallSession;
  onAccept: () => void;
  onHangup: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && session.localStream) {
      localVideoRef.current.srcObject = session.localStream;
    }
  }, [session.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && session.remoteStream) {
      remoteVideoRef.current.srcObject = session.remoteStream;
    }
  }, [session.remoteStream]);

  if (!session.isActive) return null;

  return (
    <div
      className={cn(
        "fixed z-[100] flex flex-col items-center justify-center bg-black/90 transition-all duration-300 backdrop-blur-md",
        isMaximized
          ? "inset-0"
          : "bottom-20 right-4 w-72 h-48 rounded-2xl overflow-hidden shadow-2xl border border-white/10 sm:w-80 sm:h-52 lg:w-96 lg:h-64"
      )}
    >
      {/* Remote Video (Full Size) */}
      <div className="relative w-full h-full bg-surface-3 flex items-center justify-center">
        {session.remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="h-20 w-20 rounded-full bg-brand/20 flex items-center justify-center animate-pulse">
              <Phone className="h-8 w-8 text-brand" />
            </div>
            <div>
              <p className="text-white font-bold">
                {session.isIncoming ? "Incoming Call..." : "Calling Support..."}
              </p>
              <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest font-bold">
                {session.isScreenSharing ? "Screen Sharing Session" : "Voice & Video Call"}
              </p>
            </div>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {session.localStream && (
          <div className="absolute top-4 right-4 w-24 h-16 rounded-lg overflow-hidden border border-white/20 shadow-lg bg-black sm:w-32 sm:h-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          </div>
        )}

        {/* Controls Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-4">
          {session.error && (
            <p className="text-[10px] text-danger text-center font-bold bg-danger/10 py-1 rounded">
              {session.error}
            </p>
          )}

          <div className="flex items-center justify-center gap-4">
            {session.isIncoming && !session.isAccepted ? (
              <>
                <button
                  onClick={onAccept}
                  className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 transition-colors shadow-lg"
                  title="Accept Call"
                >
                  <Phone className="h-6 w-6" />
                </button>
                <button
                  onClick={onHangup}
                  className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-lg"
                  title="Decline"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onHangup}
                  className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-lg"
                  title="End Call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  {isMaximized ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
