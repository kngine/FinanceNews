"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const TRIGGER_DISTANCE = 72;
const MAX_DISTANCE = 110;
const RESISTANCE = 0.5;

export function RefreshGesture() {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
    } catch {
      // Ignore network hiccups; we still refresh the route below.
    }
    router.refresh();
    // Give the server a beat to stream fresh data before snapping back.
    window.setTimeout(() => {
      setRefreshing(false);
      setDistance(0);
    }, 650);
  }, [router]);

  useEffect(() => {
    function onTouchStart(event: TouchEvent) {
      if (window.scrollY <= 0 && !refreshing) {
        startY.current = event.touches[0].clientY;
      } else {
        startY.current = null;
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (startY.current === null || refreshing) {
        return;
      }

      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0 || window.scrollY > 0) {
        setDistance(0);
        return;
      }

      setDistance(Math.min(delta * RESISTANCE, MAX_DISTANCE));
    }

    function onTouchEnd() {
      if (startY.current === null) {
        return;
      }
      startY.current = null;

      if (distance >= TRIGGER_DISTANCE && !refreshing) {
        triggerRefresh();
      } else {
        setDistance(0);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [distance, refreshing, triggerRefresh]);

  const progress = Math.min(distance / TRIGGER_DISTANCE, 1);
  const armed = progress >= 1;
  const visible = refreshing || distance > 0;

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{
        transform: `translateY(${refreshing ? 18 : distance - 44}px)`,
        opacity: visible ? 1 : 0,
        transition:
          startY.current === null ? "transform 0.25s ease, opacity 0.25s ease" : "none",
      }}
    >
      <div className="mt-2 flex size-10 items-center justify-center rounded-full border border-line bg-surface shadow-card">
        <svg
          className={`size-5 text-rh-green ${refreshing ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
            opacity: armed || refreshing ? 1 : 0.5 + progress * 0.5,
          }}
          viewBox="0 0 24 24"
        >
          <path
            d="M21 12a9 9 0 1 1-2.64-6.36"
            strokeLinecap="round"
          />
          {!refreshing ? (
            <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </svg>
      </div>
    </div>
  );
}
