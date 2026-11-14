"use client";

import { useEffect, useRef, useState } from "react";

// Wide tables scroll sideways inside their box, but the box's own scrollbar is at its bottom edge,
// often below the screen. This pins a synced copy to the bottom of the viewport while that happens.
const SCROLLERS = "main .overflow-x-auto, main .overflow-auto";

type Bar = { left: number; width: number; scrollWidth: number; dir: string };

export function FloatingScrollbar() {
  const barRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const [bar, setBar] = useState<Bar | null>(null);

  useEffect(() => {
    let frame = 0;
    const pick = () => {
      frame = 0;
      const viewport = window.innerHeight;
      let best: HTMLElement | null = null;
      let bestVisible = 0;
      document.querySelectorAll<HTMLElement>(SCROLLERS).forEach((element) => {
        if (element.scrollWidth <= element.clientWidth + 1) return;
        const rect = element.getBoundingClientRect();
        // only when its own scrollbar is off screen and enough of the table is showing
        if (rect.bottom <= viewport || rect.top > viewport - 80) return;
        const visible = Math.min(rect.bottom, viewport) - Math.max(rect.top, 0);
        if (visible > bestVisible) { best = element; bestVisible = visible; }
      });
      const target = best as HTMLElement | null;
      if (target !== targetRef.current) {
        targetRef.current?.removeEventListener("scroll", follow);
        target?.addEventListener("scroll", follow, { passive: true });
        targetRef.current = target;
      }
      if (!target) return setBar(null);
      const rect = target.getBoundingClientRect();
      // RTL boxes use negative scrollLeft, so the bar has to share the direction
      const dir = getComputedStyle(target).direction;
      setBar((current) => current && current.left === rect.left && current.width === rect.width && current.scrollWidth === target.scrollWidth && current.dir === dir ? current : { left: rect.left, width: rect.width, scrollWidth: target.scrollWidth, dir });
      follow();
    };
    const follow = () => {
      if (barRef.current && targetRef.current && Math.abs(barRef.current.scrollLeft - targetRef.current.scrollLeft) > 1) barRef.current.scrollLeft = targetRef.current.scrollLeft;
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(pick); };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      targetRef.current?.removeEventListener("scroll", follow);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (bar && barRef.current && targetRef.current) barRef.current.scrollLeft = targetRef.current.scrollLeft;
  }, [bar]);

  if (!bar) return null;
  return (
    <div
      ref={barRef}
      dir={bar.dir}
      className="floating-scrollbar fixed z-40 overflow-x-auto overflow-y-hidden border-t bg-white/95 print:hidden"
      style={{ left: bar.left, width: bar.width, bottom: "env(safe-area-inset-bottom, 0px)" }}
      onScroll={(event) => { if (targetRef.current) targetRef.current.scrollLeft = event.currentTarget.scrollLeft; }}
      aria-hidden="true"
    >
      <div style={{ width: bar.scrollWidth, height: 1 }} />
    </div>
  );
}
