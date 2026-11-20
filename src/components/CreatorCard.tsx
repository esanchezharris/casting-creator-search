"use client";

import { forwardRef, useState } from "react";
import type { Creator } from "@/lib/types";

export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`
  : String(n);

type Props = {
  creator: Creator;
  reason: string | null;
  picked: boolean;
  focused: boolean;
  onPick: () => void;
  onFocus: () => void;
};

/**
 * Scrub preview: the pointer's horizontal position across the photo picks
 * which image is showing, so a whole profile can be skimmed in one sweep.
 */
export const CreatorCard = forwardRef<HTMLElement, Props>(function CreatorCard(
  { creator, reason, picked, focused, onPick, onFocus }, ref,
) {
  const [index, setIndex] = useState(0);
  // Only the first image loads up front; the rest mount on first hover.
  const [armed, setArmed] = useState(false);
  const n = creator.images.length;

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    setIndex(Math.max(0, Math.min(n - 1, Math.floor(x * n))));
  };

  const place = [creator.city, creator.region || creator.country].filter(Boolean).join(", ");

  return (
    <article
      ref={ref}
      tabIndex={-1}
      className={`card${picked ? " picked" : ""}${focused ? " focused" : ""}`}
      onPointerEnter={() => { setArmed(true); onFocus(); }}
      aria-label={`${creator.name}, ${compact(creator.followers)} followers, ${place}`}
    >
      <div
        className="frame"
        onPointerMove={scrub}
        onPointerLeave={() => setIndex(0)}
      >
        {creator.images.map((src, i) =>
          i === 0 || armed ? (
            <img
              key={src}
              src={src}
              alt={i === 0 ? `${creator.name}` : ""}
              className={i === index ? "on" : ""}
              loading={i === 0 ? "lazy" : "eager"}
              draggable={false}
            />
          ) : null,
        )}
        <div className="ticks" aria-hidden="true">
          {creator.images.map((_, i) => <i key={i} className={i === index ? "on" : ""} />)}
        </div>
      </div>

      <div className="who">
        <h3>{creator.name}</h3>
        <p>{creator.handle}, {place}</p>
        <p>{creator.niches.map((x) => x[0].toUpperCase() + x.slice(1)).join(" and ")}</p>
      </div>
      <div className="facts">
        <div><b>{compact(creator.followers)}</b>followers</div>
        <div><b>{creator.engagement}%</b>engagement</div>
        <div><b>${creator.rate.toLocaleString("en-US")}</b>per reel</div>
      </div>
      {reason && <p className="why"><span>Why this match</span>{reason}</p>}

      <button className="pick" onClick={onPick} aria-pressed={picked}>
        <kbd>S</kbd>
        {picked ? "Shortlisted" : "Shortlist"}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M3.5 9.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </article>
  );
});
