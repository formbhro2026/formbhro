import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useUserStore } from "@/lib/user-store";
import { AddDocumentModal } from "@/components/documents/AddDocumentModal";

type FillNowContext = {
  openFillNow: () => Promise<void>;
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

  const openFillNow = useCallback(async () => {
    if (isStartingChat) return;
    setIsStartingChat(true);
    try {
      const newRequest = await createRequest("Form Assistance");
      const targetId = newRequest.id;
      navigate({ to: "/app/chats/$requestId", params: { requestId: targetId } });
    } catch (err) {
      console.error("[FillNow] Failed to create chat:", err);
      navigate({ to: "/app/chats" });
    } finally {
      setIsStartingChat(false);
    }
  }, [createRequest, navigate, isStartingChat]);

  useEffect(() => {
    if (!fillParam) return;
    void openFillNow();
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
    </Ctx.Provider>
  );
}
