"use client";

import { useEffect, useRef, useState, useCallback, startTransition, RefObject } from "react";

const THRESHOLD = 70;
const MAX_PULL = 100;

export type PullState = "idle" | "pulling" | "ready" | "refreshing";

export function usePullToRefresh({
  ref,
  onRefresh,
  enabled = true,
}: {
  ref: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<unknown>;
  enabled?: boolean;
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [state, setState] = useState<PullState>("idle");

  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);
  const currentDist = useRef(0);

  const doRefresh = useCallback(async () => {
    refreshing.current = true;
    setState("refreshing");
    setPullDistance(THRESHOLD);
    try {
      await startTransition(async () => {
        await onRefresh();
      });
    } finally {
      refreshing.current = false;
      setState("idle");
      setPullDistance(0);
      currentDist.current = 0;
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    function onTouchStart(e: TouchEvent) {
      if (refreshing.current) return;
      if (el!.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current || refreshing.current) return;
      if (el!.scrollTop > 0) {
        pulling.current = false;
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) return;
      const dist = Math.min(dy * 0.5, MAX_PULL);
      currentDist.current = dist;
      setPullDistance(dist);
      setState(dist >= THRESHOLD ? "ready" : "pulling");
      if (dy > 5) e.preventDefault();
    }

    function onTouchEnd() {
      if (!pulling.current || refreshing.current) return;
      pulling.current = false;
      const dist = currentDist.current;
      if (dist >= THRESHOLD) {
        doRefresh();
      } else {
        setState("idle");
        setPullDistance(0);
        currentDist.current = 0;
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, enabled, doRefresh]);

  return { pullDistance, state };
}
