/**
 * Makes a change to the layout, then moves each element from where it was drawn to where
 * the change put it. Only transforms animate, so the layout is worked out once, not per frame.
 * A second change mid-move starts from where things are on screen, not from where they were heading.
 *
 * `sized` also carries each card from the size it was drawn at to its new one. Leave it off when
 * something else is already changing the size frame by frame (the zoom during a slider drag):
 * starting again from the old size would hold the cards still for a frame at every re-wrap.
 */
const moving = new WeakMap<Element, Animation>();
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export function glide(elements: Iterable<Element>, change: () => void, ms = 240, sized = true) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { change(); return; }
  const els = [...elements];
  const from = els.map((el) => el.getBoundingClientRect());
  for (const el of els) moving.get(el)?.cancel();
  change();
  const bottom = window.innerHeight;
  const seen = (r: DOMRect) => r.bottom > 0 && r.top < bottom;
  els.forEach((el, i) => {
    const a = from[i], b = el.getBoundingClientRect();
    if (!b.width || (!seen(a) && !seen(b))) return;
    // Inside something drawn at a zoom, a move of one pixel on screen is less or more than a pixel here.
    const zoom = el instanceof HTMLElement && el.offsetWidth ? b.width / el.offsetWidth : 1;
    const dx = (a.left - b.left) / zoom, dy = (a.top - b.top) / zoom;
    // Cards change size with the grid. Anything else only changes place.
    const scale = sized && el.hasAttribute("data-card") ? a.width / b.width : 1;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.005) return;
    moving.set(el, el.animate(
      [
        { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: ms, easing: EASE_OUT },
    ));
  });
}
