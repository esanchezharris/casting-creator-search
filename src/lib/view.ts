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

export function savedCardSize(): number {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY));
    if (n >= 100 && n <= 500) return n;
  } catch { /* use the default */ }
  return DEFAULT_CARD;
}

export function saveCardSize(px: number) {
  document.documentElement.style.setProperty("--card-min", `${px}px`);
  try { localStorage.setItem(SIZE_KEY, String(px)); } catch { /* not remembered */ }
}
