import { useRef, useState, useEffect, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}

const THRESHOLD = 60;
const MAX_PULL = 80;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getScrollContainer = (): { scrollTop: number } => {
      let parent: HTMLElement | null = el.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        const oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll") && parent.scrollHeight > parent.clientHeight) {
          return parent;
        }
        parent = parent.parentElement;
      }
      const root = document.getElementById("root");
      if (root) return root;
      return { scrollTop: window.scrollY };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (loading) return;
      const sc = getScrollContainer();
      if (sc.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || loading) return;
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY > 0) {
        e.preventDefault();
        const damped = Math.min(MAX_PULL, deltaY * 0.5);
        setPullDistance(damped);
      } else {
        setPullDistance(0);
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistance >= THRESHOLD) {
        setLoading(true);
        setPullDistance(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          setLoading(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, loading, pullDistance]);

  const reached = pullDistance >= THRESHOLD;
  const indicatorHeight = loading ? THRESHOLD : pullDistance;

  return (
    <div ref={containerRef}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{
          height: `${indicatorHeight}px`,
          maxHeight: `${MAX_PULL}px`,
        }}
        aria-hidden={!loading && pullDistance === 0}
      >
        <div
          className={cn(
            "flex items-center gap-2 h-10 px-3 rounded-full bg-transparent text-xs",
            reached || loading ? "text-primary" : "text-muted-foreground"
          )}
        >
          <RefreshCw
            className={cn(
              "h-4 w-4 transition-transform",
              loading && "animate-spin"
            )}
            style={!loading ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined}
          />
          {loading && <span>Atualizando...</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default PullToRefresh;