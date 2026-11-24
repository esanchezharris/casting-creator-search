"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Grid2x2, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { glide } from "@/lib/glide";
import { cn } from "@/lib/utils";
import { cardSize, DEFAULT_CARD, GAP, GLIDING, holdColumns, saveCardSize, savedCardSize } from "@/lib/view";
import { zoomEnd, zoomStart, zoomTo } from "@/lib/zoom";

// The narrowest and widest a creator card may be drawn.
const SMALLEST = 150, LARGEST = 400;
// The width of a card when a grid this wide has this many columns. Between stops the number is not whole.
const fill = (width: number, columns: number) => (width + GAP) / columns - GAP;
// The card size to ask for to get this many columns: the middle of the range of sizes that gives
// that count, so a small change in the window keeps it.
const sizeFor = (width: number, columns: number) => Math.round((fill(width, columns + 1) + fill(width, columns)) / 2);

// How quickly the drawn size closes on the thumb: a spring with no bounce. At a steady pace the
// cards trail the thumb by 2 / STIFF seconds.
const STIFF = 26;
// The grid re-wraps a little past halfway between two stops, so a hand resting on the halfway
// point does not flip it back and forth.
const PAST = 0.58;

/**
 * How big the creator cards are. The grid fits as many columns as it can of at least the chosen
 * width, so the slider has one stop per number of columns that fits the grid right now.
 *
 * A drag is continuous. The thumb is under the pointer; the size the cards are drawn at chases
 * the thumb on a spring, one frame at a time, so a pointer that moves a pixel every so often or
 * half the track at once both come out as steady motion. Between stops the size is made by
 * zooming the results, and the cards re-wrap into the next number of columns as it passes
 * halfway (at the same drawn size, so only their places change). On release the spring carries
 * on to the nearest stop. Everything here keeps its own state, and the per-frame part keeps
 * none in React, so a drag, or the grid changing width as the filter panel slides, never
 * redraws the page.
 */
export function CardSize({ grid }: { grid: RefObject<HTMLElement | null> }) {
  const [cardMin, setCardMin] = useState(DEFAULT_CARD);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  // The drag in progress. `target` is where the thumb is and `shown` the size on screen, both in
  // stops and not whole; `columns` is what the grid is laid out in.
  const motion = useRef({ on: false, held: false, flat: false, target: 0, shown: 0, speed: 0, columns: 0, width: 0, most: 1, then: 0, frame: 0 });

  useEffect(() => {
    setCardMin(savedCardSize());
    const m = motion.current;
    if (!grid.current) return;
    const seen = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    seen.observe(grid.current);
    return () => { seen.disconnect(); cancelAnimationFrame(m.frame); };
  }, [grid]);

  const columnsAt = (min: number) => Math.max(1, Math.floor((width + GAP) / (min + GAP)));
  const most = columnsAt(SMALLEST);
  const fewest = Math.min(most, Math.max(1, Math.ceil((width + GAP) / (LARGEST + GAP))));
  const stops = most - fewest;
  // Left is the densest grid, right the largest cards.
  const stop = most - Math.min(most, Math.max(fewest, columnsAt(cardMin)));

  // The creator at the top of the screen, who stays where they are while the grid changes around them.
  const topCard = () => (window.scrollY > 0 ? [...document.querySelectorAll("main [data-card]")].find((c) => c.getBoundingClientRect().bottom > 56) ?? null : null);

  /** Lays the grid out in this many columns, keeping the creator at the top of the screen in place. */
  const wrap = (apply: (top: Element | null) => void) => {
    const el = topCard();
    const before = el?.getBoundingClientRect().top;
    apply(el);
    if (el && before != null) window.scrollBy(0, el.getBoundingClientRect().top - before);
  };

  /** The drag is over and the cards have landed: the page takes the size and the grids fit their own columns again. */
  const finish = () => {
    const m = motion.current;
    if (!m.on) return;
    cancelAnimationFrame(m.frame);
    m.on = m.held = false;
    wrap(() => { saveCardSize(sizeFor(m.width, m.most - Math.round(m.target))); holdColumns(); zoomEnd(); });
  };

  /** One frame of a drag: the drawn size moves toward the thumb, and the grid re-wraps if it has passed halfway. */
  const frame = (now: number) => {
    const m = motion.current;
    const dt = Math.max(0, Math.min(0.1, (now - m.then) / 1000));
    m.then = now;
    if (m.flat) { m.shown = m.target; m.speed = 0; }
    else {
      // A critically damped spring, solved exactly for the time since the last frame, so a late frame cannot overshoot.
      const off = m.shown - m.target, c = m.speed + STIFF * off, e = Math.exp(-STIFF * dt);
      m.shown = m.target + (off + c * dt) * e;
      m.speed = (c - STIFF * (off + c * dt)) * e;
    }
    const rest = !m.held && Math.abs(m.shown - m.target) < 0.004 && Math.abs(m.speed) < 0.05;
    if (rest) m.shown = m.target;
    const at = m.most - m.shown;
    const columns = rest || Math.abs(at - m.columns) > PAST ? Math.round(at) : m.columns;
    const z = m.flat ? 1 : fill(m.width, at) / fill(m.width, columns);
    if (columns === m.columns) zoomTo(z);
    else {
      m.columns = columns;
      // Mid-drag only the grids are told their columns. Writing the size to the page restyles
      // every card, which would hold the frame up; that waits until the cards have landed.
      glide(document.querySelectorAll(GLIDING), () => wrap((top) => {
        holdColumns(columns); saveCardSize(sizeFor(m.width, columns), false); zoomTo(z, top);
      }), 240, false);
    }
    if (rest) finish(); else m.frame = requestAnimationFrame(frame);
  };

  /** The thumb has moved under the pointer. */
  const follow = (at: number) => {
    const m = motion.current;
    m.target = at; m.held = true;
    setDrag(at);
    if (m.on) return; // caught while still settling from the last drag: carry on from where it is
    Object.assign(m, { on: true, flat: window.matchMedia("(prefers-reduced-motion: reduce)").matches, shown: stop, speed: 0, columns: most - stop, width, most, then: performance.now() });
    zoomStart();
    zoomTo(1, topCard());
    m.frame = requestAnimationFrame(frame);
  };
  /** Letting go: the thumb and the cards carry on to the nearest stop. */
  const release = () => {
    const m = motion.current;
    if (!m.on) return;
    m.held = false;
    m.target = Math.max(0, Math.min(stops, Math.round(m.target)));
    setDrag(null);
    setCardMin(sizeFor(m.width, m.most - m.target));
  };

  /** A button or a key: one whole stop. */
  const step = (next: number, by: "press" | "keys") => {
    finish();
    const px = sizeFor(width, most - Math.max(0, Math.min(stops, next)));
    if (px === cardSize()) return;
    const reflow = () => { wrap(() => { saveCardSize(px); holdColumns(); }); };
    // The cards travel to their new places instead of jumping there. The keyboard does not animate.
    if (by === "keys") reflow(); else glide(document.querySelectorAll(GLIDING), reflow);
    setDrag(null);
    setCardMin(px);
  };

  const keys: Record<string, number> = { ArrowLeft: stop - 1, ArrowDown: stop - 1, ArrowRight: stop + 1, ArrowUp: stop + 1, Home: 0, End: stops };

  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" className="press size-7 text-muted-foreground" aria-label="Smaller cards" disabled={stop <= 0} onClick={() => step(stop - 1, "press")} />}>
          <Grid3x3 className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>Smaller cards</TooltipContent>
      </Tooltip>
      <div
        className={cn(
          "w-20",
          // Settling on a stop is a short move. While the pointer has the thumb, nothing eases.
          drag == null && "[&_[data-slot=slider-range]]:transition-[width] [&_[data-slot=slider-range]]:duration-150 [&_[data-slot=slider-range]]:ease-(--ease-out) [&_[data-slot=slider-thumb]]:transition-[inset-inline-start,box-shadow] [&_[data-slot=slider-thumb]]:duration-150 [&_[data-slot=slider-thumb]]:ease-(--ease-out) motion-reduce:[&_[data-slot=slider-range]]:transition-none motion-reduce:[&_[data-slot=slider-thumb]]:transition-none",
        )}
        // The keyboard moves a whole stop at a time.
        onKeyDownCapture={(e) => {
          if (!(e.key in keys)) return;
          e.preventDefault(); e.stopPropagation();
          step(keys[e.key], "keys");
        }}
        // After a drag the keyboard goes back to the grid, so the arrow keys move between creators again.
        onPointerUp={(e) => { const box = e.currentTarget; requestAnimationFrame(() => { if (box.contains(document.activeElement)) (document.activeElement as HTMLElement).blur(); }); }}
      >
        <Slider
          labels={["Card size"]} min={0} max={Math.max(1, stops)} step={0.01} disabled={stops === 0}
          value={[drag ?? stop]}
          onValueChange={(v) => follow((v as number[])[0])}
          onValueCommitted={release}
        />
      </div>
      <Tooltip>
        <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" className="press size-7 text-muted-foreground" aria-label="Larger cards" disabled={stop >= stops} onClick={() => step(stop + 1, "press")} />}>
          <Grid2x2 className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>Larger cards</TooltipContent>
      </Tooltip>
    </div>
  );
}
