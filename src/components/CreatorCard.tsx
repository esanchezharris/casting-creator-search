"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Check, Play, Plus, TriangleAlert, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Creator, SearchResult, Stage } from "@/lib/types";

export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`
  : String(n);
export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
export const placeOf = (c: Creator) => [c.city, c.region || c.country].filter(Boolean).join(", ");
export const nichesOf = (c: Creator) => c.niches.map((x) => x[0].toUpperCase() + x.slice(1)).join(" and ");
export const STAGE_LABEL: Record<Stage, string> = { roster: "Roster", applicant: "Applicant", prospect: "Prospect" };

/** Every profile shows this many frames, whether they are photos or placeholders. */
export const FRAME_COUNT = 5;
const FIVE = [0, 1, 2, 3, 4];
export const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2);
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement || t instanceof HTMLSelectElement;

/**
 * Scrub preview: the pointer's horizontal position across the photo picks
 * which frame is showing, so a whole profile can be skimmed in one sweep.
 * Mouse scrubs on hover; touch scrubs while dragging sideways. The frame
 * stays where it was left. With
 * `keys` on, `,` and `.` step through the frames too.
 */
export function useScrub(n: number, keys: boolean, start = 0) {
  const [index, setIndex] = useState(Math.min(start, n - 1));
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
  };
  // Nothing resets on leave: the frame last looked at stays, and a click opens quick look on it.
  return { index, setIndex, bind };
}

/**
 * The frames themselves. With no photos on file this draws deliberate
 * placeholders (initials and a frame number on a neutral tint) so the scrub
 * still reads clearly.
 */
export function Frames({ creator, index, loadAll, order }: { creator: Creator; index: number; loadAll: boolean; order?: number[] }) {
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
      {(order ?? creator.images.map((_, i) => i)).map((photo, i) =>
        i === 0 || loadAll ? (
          <img
            key={creator.images[photo]} src={creator.images[photo]} alt={i === 0 ? creator.name : ""}
            className={i === index ? "on" : ""} loading={i === 0 ? "lazy" : "eager"} draggable={false}
          />
        ) : null,
      )}
    </>
  );
}

/**
 * A creator's clip, drawn over the photo it was made from. It plays, with the
 * sound off, only while its frame is the one showing, and rewinds when it is
 * not. `sound` adds the small glass button that turns the sound on.
 */
export function Clip({ src, active, sound }: { src: string; active: boolean; sound?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active) v.play().catch(() => { /* the photo stays up */ });
    else { v.pause(); if (v.currentTime) v.currentTime = 0; }
  }, [active]);
  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted]);
  return (
    <>
      <video ref={video} src={src} muted loop playsInline preload={active ? "auto" : "none"} className={active ? "on" : ""} />
      {sound && active && (
        <button
          onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          aria-pressed={!muted}
          className="press absolute right-3 bottom-3 grid size-9 cursor-pointer place-items-center rounded-full bg-black/30 text-white backdrop-blur-md hover:bg-black/45"
        >
          {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
        </button>
      )}
    </>
  );
}

/** Marks a frame as a clip while it is showing its still. */
export function ClipMark() {
  return <Play className="pointer-events-none absolute top-3 left-3 size-4 fill-white text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.5)]" aria-hidden="true" />;
}

export function Ticks({ count, index, show }: { count: number; index: number; show?: boolean }) {
  return (
    <div className={cn("ticks", show && "show")} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <i key={i} className={i === index ? "on" : ""} />)}
    </div>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge variant={stage === "roster" ? "secondary" : "outline"} className={cn("h-[22px] rounded-[5px] px-1.5 text-[13px] font-normal", stage === "roster" ? "bg-muted" : "border-foreground/40")}>
      {STAGE_LABEL[stage]}
    </Badge>
  );
}

/** The four numbers a talent partner reads first. */
export function Facts({ creator, className }: { creator: Creator; className?: string }) {
  const facts: [string, string][] = [
    [compact(creator.recentReach), "reach"],
    // Short labels and a compact rate, so four numbers fit under a narrow card without truncating.
    // Under the smallest card sizes they are set two by two instead.
    [`${creator.engagement}%`, "eng."],
    [`${creator.audience.us}%`, "US"],
    creator.rate != null ? [`$${compact(creator.rate)}`, "rate"] : ["None", "rate"],
  ];
  return (
    <dl className={cn("grid grid-cols-4 gap-2 @max-[180px]/card:grid-cols-2 @max-[180px]/card:gap-y-1.5", className)}>
      {facts.map(([value, label]) => (
        <div key={label} className="min-w-0">
          <dd className="truncate text-[14px] font-medium tabular-nums">{value}</dd>
          <dt className="truncate text-[13px] text-muted-foreground">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function Warning({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("flex gap-2 rounded-lg border bg-card px-2.5 py-2 text-[13px] leading-snug", className)}>
      <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
      <span><span className="font-medium">Check before pitching.</span> {text}</span>
    </p>
  );
}

type Props = {
  result: SearchResult;
  picked: boolean;
  focused: boolean;
  onPick: () => void;
  onFocus: () => void;
  onLeave: () => void;
  onOpen: () => void;
  /** Reports the frame on show, so quick look can open on the same post. */
  onFrame: (index: number) => void;
};

export const CreatorCard = forwardRef<HTMLElement, Props>(function CreatorCard(
  { result, picked, focused, onPick, onFocus, onLeave, onOpen, onFrame }, ref,
) {
  const { creator, reason, warning } = result;
  // A card previews the newest five posts, however long the history; quick look has the rest.
  const count = Math.min(creator.images.length || FRAME_COUNT, FRAME_COUNT);
  const { index, bind } = useScrub(count, focused);
  useEffect(() => { onFrame(index); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only the cover loads up front. The other frames load a moment after the card is on screen,
  // so a page of covers is never queued behind several hundred photos nobody has swept yet.
  const [near, setNear] = useState(false);
  const el = useRef<HTMLElement | null>(null);
  const downX = useRef(0);
  useEffect(() => {
    if (!el.current || near || !("IntersectionObserver" in window)) return;
    let timer = 0;
    const io = new IntersectionObserver((entries) => {
      const seen = entries.some((x) => x.isIntersecting);
      window.clearTimeout(timer);
      if (seen) timer = window.setTimeout(() => { setNear(true); io.disconnect(); }, 1200);
    });
    io.observe(el.current);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, [near]);

  return (
    <article
      ref={(node) => { el.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; }}
      tabIndex={-1}
      data-card
      className={cn(
        "group/card @container/card flex flex-col rounded-2xl border border-transparent p-2 outline-none transition-colors duration-150",
        focused && "border-border bg-card",
      )}
      onPointerEnter={(e) => { setNear(true); if (e.pointerType === "mouse") onFocus(); }}
      // The highlight follows the mouse: it leaves when the mouse does.
      onPointerLeave={(e) => { if (e.pointerType === "mouse") onLeave(); }}
      aria-label={`${creator.name}, ${STAGE_LABEL[creator.stage]}, ${compact(creator.recentReach)} recent reach, ${placeOf(creator)}`}
    >
      <div className="relative">
        {/* A click opens quick look; a sideways drag on a touch screen is a scrub, not a click. */}
        <div
          className="frame" {...bind}
          onPointerDownCapture={(e) => { downX.current = e.clientX; }}
          onClick={(e) => { if (Math.abs(e.clientX - downX.current) < 8) onOpen(); }}
        >
          <Frames creator={creator} index={index} loadAll={near} order={FIVE.slice(0, count)} />
          {/* The clip plays while the mouse or the arrow keys are on its frame. */}
          {creator.video && near && <Clip src={creator.video} active={focused && index === creator.videoAt} />}
          {creator.video && index === creator.videoAt && !focused && <ClipMark />}
          <Ticks count={count} index={index} show={focused} />
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={onPick}
                aria-pressed={picked}
                aria-label={picked ? `Remove ${creator.name} from the shortlist` : `Add ${creator.name} to the shortlist`}
                className={cn(
                  "press absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full",
                  picked
                    ? "bg-primary text-primary-foreground"
                    : "bg-card/90 text-foreground backdrop-blur-sm hover:bg-card [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100 focus-visible:opacity-100",
                  focused && "opacity-100!",
                )}
              />
            }
          >
            {picked ? <Check className="size-[18px]" /> : <Plus className="size-[18px]" />}
          </TooltipTrigger>
          <TooltipContent>{picked ? "Shortlisted" : "Shortlist"} <Kbd>S</Kbd></TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-1 flex-col px-1 pt-2.5 pb-1">
        {/* On a small card the stage sits under the name, so the name keeps the full width. */}
        <div className="flex items-center justify-between gap-2 @max-[180px]/card:flex-col @max-[180px]/card:items-start @max-[180px]/card:gap-1">
          <h3 className="max-w-full min-w-0 text-[15px] leading-tight font-medium">
            <button onClick={onOpen} className="max-w-full truncate text-left underline-offset-4 hover:underline">
              {creator.name}
            </button>
          </h3>
          <StageBadge stage={creator.stage} />
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{nichesOf(creator)} · {placeOf(creator)}</p>

        <Facts creator={creator} className="mt-2.5" />

        {warning && <Warning text={warning} className="mt-3" />}
        {reason && <p className="mt-2.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{reason}</p>}
      </div>
    </article>
  );
});
