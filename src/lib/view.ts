"use client";

import { useSyncExternalStore } from "react";
import { SIZE_KEY, THEME_KEY } from "./view-boot";

/**
 * How the page is viewed: light or dark, and how big the creator cards are.
 * Both are remembered in the browser. The theme lives on <html data-mode>, and
 * the card size in the --card-min variable the results grid reads.
 */
export type Mode = "light" | "dark";
export const DEFAULT_CARD = 220;

const read = (): Mode => (document.documentElement.dataset.mode === "dark" ? "dark" : "light");
function watch(changed: () => void) {
  const seen = new MutationObserver(changed);
  seen.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => seen.disconnect();
}

export function useMode(): Mode {
  return useSyncExternalStore(watch, read, () => "light");
}

export function setMode(mode: Mode) {
  const root = document.documentElement;
  // Every colour changes in the same frame, instead of each element fading on its own timer.
  root.classList.add("theming");
  if (mode === "dark") root.dataset.mode = "dark"; else delete root.dataset.mode;
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* not remembered */ }
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theming")));
}

/** The grid's column gap, and what travels when the grid reflows: the cards, and the heading and footer between and below them. */
export const GAP = 4;
export const GLIDING = "main [data-card], main [data-glide]";

let size = DEFAULT_CARD;
/** The card size in use now, whether or not the browser could store it. */
export const cardSize = () => size;

export function savedCardSize(): number {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY));
    if (n >= 100 && n <= 500) size = n;
  } catch { /* use the default */ }
  return size;
}

/**
 * Remembers the size. `apply` also writes it to the page, which restyles every card, so a drag
 * leaves that until the thumb is let go.
 */
export function saveCardSize(px: number, apply = true) {
  size = px;
  if (apply) document.documentElement.style.setProperty("--card-min", `${px}px`);
  try { localStorage.setItem(SIZE_KEY, String(px)); } catch { /* not remembered */ }
}

/**
 * Holds the grids at a number of columns, and at a width if one is given, or with no number
 * lets them fit their own again. Held at the width they are heading for, the cards are laid
 * out once and not again on every frame of the filter panel's slide.
 */
export function holdColumns(columns?: number, width?: number) {
  document.querySelectorAll<HTMLElement>("main [data-grid]").forEach((g) => {
    g.style.gridTemplateColumns = columns ? `repeat(${columns}, minmax(0, 1fr))` : "";
    g.style.width = columns && width ? `${width}px` : "";
  });
}
