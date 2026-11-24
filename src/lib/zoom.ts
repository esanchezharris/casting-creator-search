/**
 * Draws the results larger or smaller than they are laid out, so that while the card size
 * slider is dragged the cards change size continuously instead of waiting for the next column
 * count. Only `scale` and `translate` change, so nothing is laid out per frame. Chrome still
 * records the page again on each frame of it (about 3ms on a laptop, measured), whichever way the
 * scale is written and whether or not the sheet is clipped.
 */
const sheet = () => document.querySelector<HTMLElement>("main [data-zoom]");
const below = () => document.querySelector<HTMLElement>("main footer");
// How far down the sheet the zoom is centred, so the row at the top of the screen stays put,
// and how tall the sheet is as laid out. Both are measured when the centre is set, not per frame.
let origin = 0, tall = 0;

/** Before a drag: the results get their own layer, drawn once and then only scaled. */
export function zoomStart() {
  const s = sheet(), f = below();
  if (s) s.style.willChange = "scale";
  if (f) f.style.willChange = "translate";
}

/**
 * `about` moves the centre of the zoom to that card's top edge (null for the top of the sheet);
 * leave it out to keep the centre.
 */
export function zoomTo(z: number, about?: Element | null) {
  const s = sheet(), f = below();
  if (!s) return;
  if (about !== undefined) {
    s.style.scale = ""; // measured as laid out
    origin = about ? about.getBoundingClientRect().top - s.getBoundingClientRect().top : 0;
    tall = s.offsetHeight;
    // 8px in is where the photos' left edges are, so they stay in line with the heading above.
    s.style.transformOrigin = `8px ${origin}px`;
  }
  s.style.scale = z === 1 ? "" : String(z);
  if (f) f.style.translate = z === 1 ? "" : `0 ${(z - 1) * (tall - origin)}px`;
}

/** After the drag has settled: back to an ordinary part of the page. */
export function zoomEnd() {
  const s = sheet(), f = below();
  if (s) { s.style.willChange = ""; s.style.scale = ""; s.style.transformOrigin = ""; }
  if (f) { f.style.willChange = ""; f.style.translate = ""; }
}
