"use client";

import { useEffect, useRef } from "react";

const MAX = 90;     // the furthest the content can be pulled, in px
const GAIN = 0.16;  // how much of each wheel step becomes pull
const DECAY = 0.86; // per frame; the content is always on its way back

/**
 * Scrolling past the end of a list pulls the content a little further and lets
 * it settle back, instead of stopping dead. Put the returned ref on the only
 * child of the scrolling element; that child's own first child is what moves,
 * so the scrolling element's extent never changes. Pass `page` when the
 * scrolling element is the document. Wheel and trackpad only: touch screens
 * already do this themselves.
 */
export function useElastic<T extends HTMLElement>(axis: "x" | "y" = "y", page = false) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const body = ref.current?.firstElementChild as HTMLElement | null;
    const scroller = page ? (document.scrollingElement as HTMLElement | null) : ref.current?.parentElement;
    if (!body || !scroller || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!page) { scroller.dataset.elastic = ""; scroller.style.overscrollBehavior = "none"; }

    let pull = 0, raf = 0;
    const tick = () => {
      pull *= DECAY;
      if (Math.abs(pull) < 0.4) pull = 0;
      body.style.transform = pull ? `translate3d(${axis === "x" ? -pull : 0}px, ${axis === "y" ? -pull : 0}px, 0)` : "";
      raf = pull ? requestAnimationFrame(tick) : 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      // The page stays still while quick look is open or while a list inside it is being scrolled.
      if (page && (document.body.style.overflow === "hidden" || (e.target as Element).closest?.("[data-elastic]"))) return;
      const unit = e.deltaMode === 1 ? 16 : 1;
      const max = axis === "y" ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth;
      let d = (axis === "y" ? e.deltaY : e.deltaX) * unit;
      const before = axis === "y" ? scroller.scrollTop : scroller.scrollLeft;
      // A plain mouse wheel has no sideways axis, so over a sideways list it scrolls that list.
      if (axis === "x" && max > 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        d = e.deltaY * unit;
        e.preventDefault();
        scroller.scrollLeft = before + d;
      }
      const past = (d < 0 && before <= 0) || (d > 0 && before >= max - 1);
      if (!past) return;
      pull += d * GAIN * (1 - Math.min(1, Math.abs(pull) / MAX));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const target: HTMLElement | Window = page ? window : scroller;
    target.addEventListener("wheel", onWheel as EventListener, { passive: false });
    return () => {
      target.removeEventListener("wheel", onWheel as EventListener);
      cancelAnimationFrame(raf);
      body.style.transform = "";
    };
  }, [axis, page]);
  return ref;
}
