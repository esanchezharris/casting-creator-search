"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import type { Creator, SearchResult, Stage } from "@/lib/types";

export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`
  : String(n);
export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
export const placeOf = (c: Creator) => [c.city, c.region || c.country].filter(Boolean).join(", ");
export const STAGE_LABEL: Record<Stage, string> = { roster: "Roster", applicant: "Applicant", prospect: "Prospect" };

/** Every profile shows this many frames, whether they are photos or placeholders. */
export const FRAME_COUNT = 5;
const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2);
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement || t instanceof HTMLSelectElement;

/**
 * Scrub preview: the pointer's horizontal position across the photo picks
 * which frame is showing, so a whole profile can be skimmed in one sweep.
 * Mouse scrubs on hover; touch scrubs while dragging sideways. With
 * `keys` on, `,` and `.` step through the frames too.
 */
export function useScrub(n: number, keys: boolean) {
  const [index, setIndex] = useState(0);
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    setIndex(Math.max(0, Math.min(n - 1, Math.floor(x * n))));
  };
  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ",") setIndex((i) => Math.max(0, i - 1));
      if (e.key === ".") setIndex((i) => Math.min(n - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, n]);
  const bind = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse") { e.currentTarget.setPointerCapture(e.pointerId); at(e); }
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" || e.currentTarget.hasPointerCapture(e.pointerId)) at(e);
    },
    // A finger lifting should leave the frame where it was; a mouse leaving resets it.
    onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => { if (e.pointerType === "mouse") setIndex(0); },
  };
  return { index, setIndex, bind };
}

/**
 * The frames themselves. With no photos on file this draws deliberate
 * placeholders (initials and a frame number on a neutral tint) so the scrub
 * still reads clearly.
 */
export function Frames({ creator, index, loadAll }: { creator: Creator; index: number; loadAll: boolean }) {
  if (!creator.images.length) {
    return (
      <>
        {Array.from({ length: FRAME_COUNT }, (_, i) => (
          <div key={i} className={`ph${i === index ? " on" : ""}`} data-i={i} aria-hidden="true">
            <b>{initials(creator.name)}</b>
            <span>{i + 1} of {FRAME_COUNT}</span>
          </div>
        ))}
      </>
    );
  }
  return (
    <>
      {creator.images.map((src, i) =>
        i === 0 || loadAll ? (
          <img
            key={src} src={src} alt={i === 0 ? creator.name : ""}
            className={i === index ? "on" : ""} loading={i === 0 ? "lazy" : "eager"} draggable={false}
          />
        ) : null,
      )}
    </>
  );
}

export const UNSPLASH_URL = "https://unsplash.com/?utm_source=casting_demo&utm_medium=referral";

/** Unsplash asks for the photographer and Unsplash to be credited, with links, wherever a photo shows. */
export function PhotoCredit({ creator }: { creator: Creator }) {
  if (!creator.photoCredit) return null;
  return (
    <p className="credit">
      Photos by <a href={creator.photoCredit.url} target="_blank" rel="noreferrer">{creator.photoCredit.name}</a> on{" "}
      <a href={UNSPLASH_URL} target="_blank" rel="noreferrer">Unsplash</a>
    </p>
  );
}

export function Ticks({ count, index }: { count: number; index: number }) {
  return (
    <div className="ticks" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <i key={i} className={i === index ? "on" : ""} />)}
    </div>
  );
}

/** The four numbers a talent partner reads first. */
export function Facts({ creator }: { creator: Creator }) {
  return (
    <div className="facts">
      <div><b>{compact(creator.recentReach)}</b>recent reach</div>
      <div><b>{creator.engagement}%</b>engagement</div>
      <div><b>{creator.audience.us}%</b>US audience</div>
      {creator.rate != null
        ? <div><b>{money(creator.rate)}</b>per reel</div>
        : <div><b>No rate yet</b>not signed</div>}
    </div>
  );
}

export function PickButton({ picked, onPick }: { picked: boolean; onPick: () => void }) {
  return (
    <button className="pick" onClick={onPick} aria-pressed={picked}>
      <kbd>S</kbd>
      {picked ? "Shortlisted" : "Shortlist"}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M3.5 9.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

type Props = {
  result: SearchResult;
  picked: boolean;
  focused: boolean;
  onPick: () => void;
  onFocus: () => void;
  onOpen: () => void;
};

export const CreatorCard = forwardRef<HTMLElement, Props>(function CreatorCard(
  { result, picked, focused, onPick, onFocus, onOpen }, ref,
) {
  const { creator, reason, warning } = result;
  const count = creator.images.length || FRAME_COUNT;
  const { index, bind } = useScrub(count, focused);

  // Only the first photo loads up front. The rest load once the card is within
  // about a row of the viewport, so the first sweep never lands on a blank frame.
  const [near, setNear] = useState(false);
  const el = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!el.current || near || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((x) => x.isIntersecting)) { setNear(true); io.disconnect(); } },
      { rootMargin: "600px 0px" },
    );
    io.observe(el.current);
    return () => io.disconnect();
  }, [near]);

  return (
    <article
      ref={(node) => { el.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; }}
      tabIndex={-1}
      className={`card${picked ? " picked" : ""}${focused ? " focused" : ""}`}
      onPointerEnter={(e) => { setNear(true); if (e.pointerType === "mouse") onFocus(); }}
      aria-label={`${creator.name}, ${STAGE_LABEL[creator.stage]}, ${compact(creator.recentReach)} recent reach, ${placeOf(creator)}`}
    >
      <div className="frame" {...bind}>
        <Frames creator={creator} index={index} loadAll={near} />
        <Ticks count={count} index={index} />
      </div>
      <PhotoCredit creator={creator} />

      <div className="who">
        <div className="who-top">
          <h3><button onClick={onOpen} title="Quick look (Space)">{creator.name}</button></h3>
          <span className={`badge ${creator.stage}`}>{STAGE_LABEL[creator.stage]}</span>
        </div>
        <p>{creator.handle} · {placeOf(creator)}</p>
        <p>
          {creator.niches.map((x) => x[0].toUpperCase() + x.slice(1)).join(" and ")}
          {" · "}
          {creator.partner ? `Partner: ${creator.partner}` : "No talent partner yet"}
        </p>
      </div>
      <Facts creator={creator} />
      {warning && <p className="warn"><span>Check before pitching</span>{warning}</p>}
      {reason && <p className="why"><span>Why this match</span>{reason}</p>}

      <PickButton picked={picked} onPick={onPick} />
    </article>
  );
});
