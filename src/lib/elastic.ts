"use client";

import { useEffect, useRef } from "react";

const MAX = 64;         // the furthest the content can be pulled, in px
const PUSH = 9;         // speed (px/s) each px of wheel travel adds past the end
const STIFFNESS = 520;  // the spring that brings the content back
const DAMPING = 46;     // critical for that stiffness: it settles without wobbling
const WINDOW = 110;     // ms of one gesture that may push; the rest of it is ignored
const GAP = 90;         // ms without a wheel step before the next one counts as a new gesture

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

    // A damped spring, stepped in real time so it moves the same at 60 and 120 frames a second.
    // The wheel only ever adds speed; the position itself is never set by hand, which is what
    // keeps it from jumping when wheel steps arrive unevenly.
    // The moving element keeps its own layer from the start. Creating one on the first frame
    // of a bounce, and dropping it on the last, is what made the old version hitch.
    body.style.willChange = "transform";
    let pull = 0, speed = 0, raf = 0, last = 0;
    // A trackpad keeps sending smaller and smaller steps for a second after the fingers lift.
    // Only the first moment of a gesture at the end of the list pushes; without that the
    // tail holds the content out and it creeps back.
    let lastStep = 0, pushedSince = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      speed += (-STIFFNESS * pull - DAMPING * speed) * dt;
      pull += speed * dt;
      const rest = Math.abs(pull) < 0.25 && Math.abs(speed) < 6;
      if (rest) pull = speed = 0;
      body.style.transform = `translate3d(${axis === "x" ? -pull : 0}px, ${axis === "y" ? -pull : 0}px, 0)`;
      raf = rest ? 0 : requestAnimationFrame(tick);
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
      const now = performance.now();
      const fresh = now - lastStep > GAP;
      lastStep = now;
      const past = (d < 0 && before <= 0) || (d > 0 && before >= max - 1);
      if (!past) { pushedSince = 0; return; }
      if (fresh || !pushedSince) pushedSince = now;
      if (now - pushedSince > WINDOW) return;
      // One wheel step can be large (a notched mouse wheel), so it is capped; the further out
      // the content already is, the less a step adds.
      const step = Math.max(-120, Math.min(120, d));
      speed += step * PUSH * (1 - Math.min(1, Math.abs(pull) / MAX));
      if (!raf) { last = now; raf = requestAnimationFrame(tick); }
    };
    const target: HTMLElement | Window = page ? window : scroller;
    // Only a sideways list ever cancels a wheel step, so only it may. Safari does not scroll an
    // element at all when it has `overscroll-behavior: none` and a wheel listener that could
    // cancel (measured in WebKit: either alone is fine, the two together leave the page still).
    target.addEventListener("wheel", onWheel as EventListener, { passive: axis !== "x" });
    return () => {
      target.removeEventListener("wheel", onWheel as EventListener);
      cancelAnimationFrame(raf);
      body.style.transform = body.style.willChange = "";
    };
  }, [axis, page]);
  return ref;
}
