/**
 * src/lib/active-chat-tracker.ts
 *
 * Canonical in-memory tracker for the currently active/focused chat room on screen.
 * Used by FCM listeners, Realtime listeners, and Store notifications to prevent
 * duplicate sound chimes, duplicate toasts, and redundant system notifications
 * when the user is already viewing the target chat room.
 */

interface ActiveChatState {
  requestId: string | null;
  requestRef: string | null;
  chatRoomId: string | null;
}

let currentActiveChat: ActiveChatState = {
  requestId: null,
  requestRef: null,
  chatRoomId: null,
};

const listeners = new Set<() => void>();

/**
 * Sets the currently active/focused chat room.
 * Call when a chat component mounts or opens.
 */
export function setActiveChat(state: Partial<ActiveChatState> | null): void {
  if (!state) {
    currentActiveChat = { requestId: null, requestRef: null, chatRoomId: null };
  } else {
    currentActiveChat = {
      requestId: state.requestId ? String(state.requestId).trim().toLowerCase() : null,
      requestRef: state.requestRef ? String(state.requestRef).trim().toLowerCase() : null,
      chatRoomId: state.chatRoomId ? String(state.chatRoomId).trim().toLowerCase() : null,
    };
  }
  listeners.forEach((fn) => fn());
}

/**
 * Returns the currently active chat state.
 */
export function getActiveChat(): ActiveChatState {
  return currentActiveChat;
}

/**
 * Registers a callback whenever the active chat changes.
 */
export function onActiveChatChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Checks whether the incoming event targets the currently active/open chat room.
 * Matches against request UUID, request reference code, chat room UUID, or URL path.
 */
export function isChatActive(target: {
  requestId?: string | null;
  requestRef?: string | null;
  chatRoomId?: string | null;
  route?: string | null;
}): boolean {
  if (typeof window === "undefined") return false;

  const activeReqId = currentActiveChat.requestId;
  const activeReqRef = currentActiveChat.requestRef;
  const activeRoomId = currentActiveChat.chatRoomId;

  // 1. Direct state matching
  if (target.requestId) {
    const tReq = String(target.requestId).trim().toLowerCase();
    if (activeReqId && tReq === activeReqId) return true;
    if (activeReqRef && tReq === activeReqRef) return true;
  }

  if (target.requestRef) {
    const tRef = String(target.requestRef).trim().toLowerCase();
    if (activeReqRef && tRef === activeReqRef) return true;
    if (activeReqId && tRef === activeReqId) return true;
  }

  if (target.chatRoomId && activeRoomId) {
    const tRoom = String(target.chatRoomId).trim().toLowerCase();
    if (tRoom === activeRoomId) return true;
  }

  // 2. URL path check fallback
  const pathname = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();

  // User chat URL: /app/chats/<id>
  if (pathname.includes("/app/chats/")) {
    const parts = pathname.split("/app/chats/");
    const currentParam = parts[1]?.split("/")[0]?.split("?")[0];
    if (currentParam) {
      if (target.requestId && currentParam === String(target.requestId).trim().toLowerCase()) return true;
      if (target.requestRef && currentParam === String(target.requestRef).trim().toLowerCase()) return true;
    }
  }

  // Team work URL: /team/work?id=<id> or ?r=<ref>
  if (pathname.includes("/team/work")) {
    const urlParams = new URLSearchParams(search);
    const idParam = urlParams.get("id")?.toLowerCase() || urlParams.get("r")?.toLowerCase();
    if (idParam) {
      if (target.requestId && idParam === String(target.requestId).trim().toLowerCase()) return true;
      if (target.requestRef && idParam === String(target.requestRef).trim().toLowerCase()) return true;
    }
  }

  // Team admin chat URL: /team/admin-chat
  if (pathname.includes("/team/admin-chat")) {
    if (activeReqId && target.requestId && activeReqId === String(target.requestId).trim().toLowerCase()) return true;
    if (activeReqRef && target.requestRef && activeReqRef === String(target.requestRef).trim().toLowerCase()) return true;
    if (activeRoomId && target.chatRoomId && activeRoomId === String(target.chatRoomId).trim().toLowerCase()) return true;
  }

  return false;
}
