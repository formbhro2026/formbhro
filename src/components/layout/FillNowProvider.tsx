import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useUserStore } from "@/lib/user-store";
import { AddDocumentModal } from "@/components/documents/AddDocumentModal";
import { StartRequestModal } from "@/components/dashboard/StartRequestModal";
import { toast } from "sonner";

type FillNowContext = {
  openFillNow: () => void;
  openAddDocument: () => void;
  isStartingChat: boolean;
};

const Ctx = createContext<FillNowContext | null>(null);

export function useFillNow() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFillNow must be used inside FillNowProvider");
  return ctx;
}

export function useAddDocument() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAddDocument must be used inside FillNowProvider");
  return { openAddDocument: ctx.openAddDocument };
}

export function FillNowProvider({ children }: { children: ReactNode }) {
  const { createRequest } = useUserStore();
  const navigate = useNavigate();
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [isStartRequestOpen, setIsStartRequestOpen] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const fillParam = useRouterState({
    select: (s) => {
      const raw = (s.location.search as { fill?: unknown }).fill;
      return raw === "" || String(raw) === "1" || String(raw) === "true";
    },
  });

  const openAddDocument = useCallback(() => {
    setIsAddDocOpen(true);
  }, []);

  const openFillNow = useCallback(() => {
    if (isStartingChat) return;
    setIsStartRequestOpen(true);
  }, [isStartingChat]);

  const handleStartRequest = async (category: string) => {
    setIsStartRequestOpen(false);
    setIsStartingChat(true);
    try {
      // Pass category for both title and category parameters for now to be safe with older code paths
      const newRequest = await createRequest(category, category);
      const targetId = newRequest.id;
      navigate({ to: "/app/chats/$requestId", params: { requestId: targetId } });
    } catch (err) {
      console.error("[FillNow] Failed to create chat:", err);
      if (err instanceof Error && err.message.includes("CHAT_LIMIT_EXCEEDED")) {
        toast.error(
          "You have reached the maximum of 3 chats within 24 hours. Please try again later.",
        );
      } else if (err instanceof Error && err.message.includes("ACTIVE_REQUEST_LIMIT_EXCEEDED")) {
        toast.error("You already have an active request. Please wait for it to be completed.");
      } else if (err instanceof Error && err.message.includes("RATE_LIMIT_EXCEEDED")) {
        toast.error("Too many requests. Please try again shortly.");
      } else {
        toast.error("Failed to start chat. Please try again.");
      }
      navigate({ to: "/app/chats" });
    } finally {
      setIsStartingChat(false);
    }
  };

  useEffect(() => {
    if (!fillParam) return;
    openFillNow();
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, fill: undefined }),
      replace: true,
    });
  }, [fillParam, openFillNow, navigate]);

  return (
    <Ctx.Provider value={{ openFillNow, openAddDocument, isStartingChat }}>
      {children}
      <AddDocumentModal isOpen={isAddDocOpen} onClose={() => setIsAddDocOpen(false)} />
      <StartRequestModal
        isOpen={isStartRequestOpen}
        onClose={() => setIsStartRequestOpen(false)}
        onSubmit={handleStartRequest}
      />
    </Ctx.Provider>
  );
}
