/**
 * src/lib/back-handler.ts
 *
 * Centralized LIFO back-action stack.
 * Allows modals, sheets, preview drawers, and search states to register
 * dismiss handlers that intercept Android hardware back button and web Esc/history back,
 * preventing accidental page navigation or chat reloads.
 */

type BackHandler = () => boolean;

const handlerStack: BackHandler[] = [];
let popstateListenerAttached = false;
let isPoppingSelf = false;

function initPopstateListener() {
  if (popstateListenerAttached || typeof window === "undefined") return;
  popstateListenerAttached = true;

  window.addEventListener("popstate", () => {
    if (isPoppingSelf) {
      isPoppingSelf = false;
      return;
    }
    if (handlerStack.length > 0) {
      handleBackAction();
    }
  });
}

/**
 * Registers a dismiss handler onto the LIFO stack.
 * In web and mobile browsers, pushes a safe history entry so back button
 * dismisses the overlay without leaving the chat page.
 * Returns an unregister cleanup function.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  initPopstateListener();
  handlerStack.push(handler);

  let pushedState = false;
  try {
    if (typeof window !== "undefined" && window.history) {
      window.history.pushState({ modalOverlay: true }, "");
      pushedState = true;
    }
  } catch (_) {}

  return () => {
    const idx = handlerStack.lastIndexOf(handler);
    if (idx !== -1) {
      handlerStack.splice(idx, 1);
    }
    if (pushedState && typeof window !== "undefined" && window.history.state?.modalOverlay) {
      isPoppingSelf = true;
      try {
        window.history.back();
      } catch (_) {}
    }
  };
}

/**
 * Handles a back action by delegating to the topmost registered handler.
 * Returns true if a handler consumed the event; false if default navigation should proceed.
 */
export function handleBackAction(): boolean {
  for (let i = handlerStack.length - 1; i >= 0; i--) {
    const handler = handlerStack[i];
    try {
      const consumed = handler();
      if (consumed) {
        return true;
      }
    } catch (err) {
      console.warn("[BackHandler] Error running handler:", err);
    }
  }
  return false;
}
