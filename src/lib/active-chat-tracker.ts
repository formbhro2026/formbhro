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

const knownMappings = new Map<string, Set<string>>();
const recentNotifKeys = new Map<string, number>();

/**
 * Returns a consistent deduplication key for notifications across FCM and Realtime events.
 */
export function getNotificationDedupKey(item: {
  type?: string | null;
  messageId?: string | null;
  requestId?: string | null;
  chatRoomId?: string | null;
  callSessionId?: string | null;
  title?: string | null;
  body?: string | null;
}): string {
  if (item.callSessionId) {
    return `call:${item.callSessionId.trim().toLowerCase()}`;
  }
  if (item.messageId) {
    return `msg:${item.messageId.trim().toLowerCase()}`;
  }
  const cleanTitle = (item.title || "").trim().toLowerCase();
  const cleanBody = (item.body || "").trim().toLowerCase();
  const target = (item.requestId || item.chatRoomId || "").trim().toLowerCase();
  return `${item.type || "notif"}:${target}:${cleanTitle}:${cleanBody}`;
}

/**
 * Checks if a notification with this key was already delivered recently.
 * Prevents double chime/toast/alert from concurrent DB realtime and FCM foreground push.
 */
export function shouldDeliverNotification(key?: string | null): boolean {
  if (!key) return true;
  const cleanKey = String(key).trim().toLowerCase();
  const now = Date.now();
  const prev = recentNotifKeys.get(cleanKey);
  if (prev && now - prev < 5000) {
    return false;
  }
  recentNotifKeys.set(cleanKey, now);
  if (recentNotifKeys.size > 200) {
    for (const [k, time] of recentNotifKeys.entries()) {
      if (now - time > 10000) recentNotifKeys.delete(k);
    }
  }
  return true;
}

/**
 * Registers an association between aliases (e.g. UUID, reference code, chatRoomId)
 */
export function registerChatMapping(...aliases: (string | null | undefined)[]): void {
  const valid = aliases
    .filter((a): a is string => Boolean(a && typeof a === "string" && a.trim().length > 0))
    .map((a) => a.trim().toLowerCase());
  
  if (valid.length < 2) return;

  const combinedSet = new Set<string>();
  for (const alias of valid) {
    combinedSet.add(alias);
    const existing = knownMappings.get(alias);
    if (existing) {
      existing.forEach((item) => combinedSet.add(item));
    }
  }

  for (const item of combinedSet) {
    knownMappings.set(item, combinedSet);
  }
}

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
    registerChatMapping(state.requestId, state.requestRef, state.chatRoomId);
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

  // If no chat is currently marked active, check URL as fallback
  const activeKeys = [activeReqId, activeReqRef, activeRoomId].filter((k): k is string => Boolean(k));
  
  // Expand active keys with known mappings
  const allActiveAliases = new Set<string>(activeKeys);
  for (const k of activeKeys) {
    const mapped = knownMappings.get(k);
    if (mapped) mapped.forEach((m) => allActiveAliases.add(m));
  }

  const targetKeys = [
    target.requestId ? String(target.requestId).trim().toLowerCase() : null,
    target.requestRef ? String(target.requestRef).trim().toLowerCase() : null,
    target.chatRoomId ? String(target.chatRoomId).trim().toLowerCase() : null,
  ].filter((k): k is string => Boolean(k));

  // Direct set intersection check
  for (const t of targetKeys) {
    if (allActiveAliases.has(t)) return true;
    const targetMapped = knownMappings.get(t);
    if (targetMapped) {
      for (const tm of targetMapped) {
        if (allActiveAliases.has(tm)) return true;
      }
    }
  }

  // 2. URL path check fallback
  const pathname = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();

  // User chat URL: /app/chats/<id>
  if (pathname.includes("/app/chats/")) {
    const parts = pathname.split("/app/chats/");
    const currentParam = parts[1]?.split("/")[0]?.split("?")[0]?.trim()?.toLowerCase();
    if (currentParam) {
      if (allActiveAliases.has(currentParam)) return true;
      for (const t of targetKeys) {
        if (t === currentParam) return true;
        const targetMapped = knownMappings.get(t);
        if (targetMapped && targetMapped.has(currentParam)) return true;
      }
    }
  }

  // Team work URL: /team/work?id=<id> or ?r=<ref>
  if (pathname.includes("/team/work")) {
    const urlParams = new URLSearchParams(search);
    const idParam = (urlParams.get("id") || urlParams.get("r"))?.trim()?.toLowerCase();
    if (idParam) {
      if (allActiveAliases.has(idParam)) return true;
      for (const t of targetKeys) {
        if (t === idParam) return true;
        const targetMapped = knownMappings.get(t);
        if (targetMapped && targetMapped.has(idParam)) return true;
      }
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
