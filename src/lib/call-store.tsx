import { createContext, useContext, type ReactNode } from "react";
import { useWebRTCCall } from "@/hooks/use-webrtc-call";
import { CallOverlay } from "@/components/chat/CallOverlay";
import { useUserStore as useStore } from "@/lib/user-store";

type CallContextType = ReturnType<typeof useWebRTCCall>;

const CallContext = createContext<CallContextType | null>(null);

export function GlobalCallProvider({ children }: { children: ReactNode }) {
  const activeRequest = useStore().activeRequest;
  
  const call = useWebRTCCall(activeRequest?.id);

  return (
    <CallContext.Provider value={call}>
      {children}
      {call.session.isActive && (
        <CallOverlay
          session={call.session}
          onAccept={call.acceptCall}
          onHangup={call.hangup}
          onSwitchCamera={call.switchCamera}
        />
      )}
    </CallContext.Provider>
  );
}

export function useGlobalCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("Missing GlobalCallProvider");
  return ctx;
}
