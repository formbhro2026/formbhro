import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface UseChatScrollOptions {
  /** Array of messages or items whose count triggers scroll evaluations */
  items: any[];
  /** Optional identifier for the current active conversation */
  chatId?: string;
  /** Distance from bottom (in px) considered "at bottom" (default 80px) */
  threshold?: number;
  /** Optional typing indicator state */
  typing?: boolean;
}

/**
 * WhatsApp-style scroll controller for chat containers.
 *
 * Rules:
 * 1. Opening / switching chat -> jump immediately to bottom without smooth animation.
 * 2. User is at/near bottom -> incoming/outgoing messages keep view pinned to bottom smoothly.
 * 3. User is scrolled up reading history -> position is strictly preserved; new messages do not steal scroll.
 * 4. Keyboard opens/closes -> if user was at bottom, keep bottom message anchored in view.
 * 5. Directly controls container.scrollTop, preventing ancestor page jumps from scrollIntoView.
 */
export function useChatScroll<T extends HTMLElement = HTMLDivElement>({
  items,
  chatId,
  threshold = 80,
  typing = false,
}: UseChatScrollOptions) {
  const containerRef = useRef<T | null>(null);
  const isNearBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewUnseen, setHasNewUnseen] = useState(false);
  const prevItemsLengthRef = useRef(items.length);
  const prevChatIdRef = useRef(chatId);

  // Check if scroll position is within threshold of the bottom
  const checkIsNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceToBottom <= threshold;
  }, [threshold]);

  // Handle scroll events on the container
  const handleScroll = useCallback(() => {
    const near = checkIsNearBottom();
    isNearBottomRef.current = near;
    setIsAtBottom(near);
    if (near) {
      setHasNewUnseen(false);
    }
  }, [checkIsNearBottom]);

  // Explicitly scroll container to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    if (behavior === "auto") {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    isNearBottomRef.current = true;
    setIsAtBottom(true);
    setHasNewUnseen(false);
  }, []);

  // On conversation switch or initial mount: instant scroll to bottom
  useLayoutEffect(() => {
    if (chatId !== prevChatIdRef.current) {
      prevChatIdRef.current = chatId;
      prevItemsLengthRef.current = items.length;
      isNearBottomRef.current = true;
      setIsAtBottom(true);
      setHasNewUnseen(false);

      const el = containerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }

      // Schedule second tick in case image or font dimensions settle
      const raf = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [chatId, items.length]);

  // On new message arrival or send
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNewItem = items.length > prevItemsLengthRef.current;
    prevItemsLengthRef.current = items.length;

    if (!isNewItem) return;

    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    } else {
      setHasNewUnseen(true);
    }
  }, [items.length]);

  // Handle typing indicator appearance while at bottom
  useEffect(() => {
    if (typing && isNearBottomRef.current && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [typing]);

  // Anchor to bottom when viewport resizes (e.g. keyboard opens/closes)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      if (isNearBottomRef.current && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    };

    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  return {
    containerRef,
    handleScroll,
    scrollToBottom,
    isAtBottom,
    hasNewUnseen,
  };
}
