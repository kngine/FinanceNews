"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function RefreshGesture() {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    function onTouchStart(event: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = event.touches[0].clientY;
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (window.scrollY > 0 || startY.current === null) {
        return;
      }

      setPulling(event.touches[0].clientY - startY.current > 70);
    }

    function onTouchEnd() {
      if (pulling) {
        router.refresh();
      }

      startY.current = null;
      setPulling(false);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pulling, router]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-3">
      <button
        className={`pointer-events-auto rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-600 shadow-card backdrop-blur transition ${
          pulling ? "translate-y-2 border-teal-200 text-market" : "-translate-y-16"
        }`}
        onClick={() => {
          setPulling(false);
          router.refresh();
        }}
        type="button"
      >
        Release to refresh
      </button>
    </div>
  );
}
