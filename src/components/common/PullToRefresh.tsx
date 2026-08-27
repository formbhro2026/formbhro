import { useState, useRef, useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const pullDistance = Math.max(0, currentY - startY);
  const maxPull = 100;
  const isPulling = pullDistance > 0 && !refreshing;
  const shouldRefresh = pullDistance >= maxPull;
  const visualPull = Math.min(pullDistance, maxPull);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let localStartY = 0;
    let localCurrentY = 0;

    const getScrollContainer = (element: HTMLElement | null): HTMLElement | Window => {
      let current = element;
      while (current && current !== document.body && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          return current;
        }
        current = current.parentElement;
      }
      return window;
    };

    const getScrollTop = (container: HTMLElement | Window) => {
      if (container === window) return window.scrollY;
      return (container as HTMLElement).scrollTop;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const scrollContainer = getScrollContainer(el);
      const scrollTop = getScrollTop(scrollContainer);

      // Only initiate pull-to-refresh if we are at the top of the page
      if (scrollTop <= 0) {
        localStartY = e.touches[0].clientY;
        localCurrentY = localStartY;
        setStartY(localStartY);
        setCurrentY(localStartY);
      } else {
        localStartY = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (localStartY > 0 && !refreshing) {
        const y = e.touches[0].clientY;
        const isPullingDown = y > localStartY;

        const scrollContainer = getScrollContainer(el);
        const scrollTop = getScrollTop(scrollContainer);

        if (isPullingDown && scrollTop <= 0) {
          // Prevent default only when actively pulling down at the top
          if (e.cancelable) {
            e.preventDefault();
          }
          localCurrentY = y;
          setCurrentY(y);
        } else if (y < localStartY) {
          // If they scroll up, abort pull-to-refresh tracking
          // so native scrolling can take over perfectly
          localStartY = 0;
          setStartY(0);
          setCurrentY(0);
        }
      }
    };

    const handleTouchEnd = async () => {
      if (localStartY > 0) {
        const distance = localCurrentY - localStartY;
        if (distance >= maxPull && !refreshing) {
          setRefreshing(true);
          try {
            await onRefresh();
          } finally {
            setRefreshing(false);
          }
        }
        localStartY = 0;
        localCurrentY = 0;
        setStartY(0);
        setCurrentY(0);
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [refreshing, onRefresh]);

  return (
    <div ref={containerRef} className="relative min-h-full">
      <div
        className="absolute left-0 right-0 top-0 flex justify-center overflow-hidden transition-all duration-200 z-50 pointer-events-none"
        style={{
          height: refreshing ? 60 : visualPull,
          opacity: refreshing || isPulling ? 1 : 0,
        }}
      >
        <div className="mt-4 flex items-center justify-center rounded-full bg-surface-1 p-2 shadow-lg border border-border-subtle h-10 w-10">
          <Loader2
            className={`h-5 w-5 text-brand ${refreshing ? "animate-spin" : ""}`}
            style={{
              transform: refreshing ? "none" : `rotate(${visualPull * 3}deg)`,
            }}
          />
        </div>
      </div>
      <div
        className="transition-transform duration-200 min-h-full"
        style={{
          transform: `translateY(${refreshing ? 60 : isPulling ? visualPull : 0}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
