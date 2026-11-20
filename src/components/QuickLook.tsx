"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Play, Plus, Volume2, VolumeX, X } from "lucide-react";
import {
  compact, Facts, FRAME_COUNT, Frames, nichesOf, placeOf, StageBadge, Ticks, useScrub, Warning,
} from "@/components/CreatorCard";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/types";

const NOTE_LABEL = { reliability: "Reliability", terms: "Terms", conflict: "Conflict", status: "Status" };

/**
 * The clip plays on a loop with the sound off, which is what browsers allow
 * without a click and what someone in an open office wants. The small glass
 * button turns the sound on.
 */
function Clip({ src, poster }: { src: string; poster?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted]);
  return (
    <>
      <video
        ref={video} src={src} poster={poster} autoPlay muted loop playsInline preload="metadata"
        className="absolute inset-0 size-full object-cover"
      />
      <button
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        aria-pressed={!muted}
        className="press absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md hover:bg-black/45"
      >
        {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
      </button>
    </>
  );
}

type Props = {
  result: SearchResult;
  position: string;
  picked: boolean;
  onPick: () => void;
  onClose: () => void;
};

/**
 * Side panel with everything on file for one creator. It is not modal: the
 * grid stays live, so the arrow keys keep moving between creators while it is
 * open. The parent keys it by creator id so the photo index resets on each move.
 */
export function QuickLook({ result, position, picked, onPick, onClose }: Props) {
  const { creator, reason, warning, matchedPost } = result;
  const count = creator.images.length || FRAME_COUNT;
  const { index, setIndex, bind } = useScrub(count, true);
  // A profile with a clip opens on it; touching a photo (or , and .) leaves it.
  const [onClip, setOnClip] = useState(!!creator.video);
  const seen = useRef(index);
  useEffect(() => {
    if (seen.current === index) return;
    // Stepping off the clip lands on the first photo, wherever the scrub index was.
    if (onClip) { setOnClip(false); if (index !== 0) setIndex(0); seen.current = 0; }
    else seen.current = index;
  }, [index, onClip, setIndex]);

  const thumb = "press relative aspect-square min-w-0 overflow-hidden rounded-lg bg-muted ring-offset-2 ring-offset-secondary aria-pressed:ring-2 aria-pressed:ring-foreground";

  return (
    <aside
      role="dialog" aria-label={`Quick look: ${creator.name}`}
      className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l bg-secondary sm:w-[440px]"
    >
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <span className="text-[13px] text-muted-foreground">Quick look · {position}</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="press -mr-2 h-8 gap-2 text-[13px] text-muted-foreground">
          Close <Kbd className="max-sm:hidden">Esc</Kbd><X className="sm:hidden" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {onClip && creator.video ? (
          <div className="frame mx-auto max-h-[46vh] cursor-default!">
            <Clip src={creator.video} poster={creator.images[0]} />
          </div>
        ) : (
          <div className="frame mx-auto max-h-[46vh]" {...bind}>
            <Frames creator={creator} index={index} loadAll />
            <Ticks count={count} index={index} show />
          </div>
        )}

        <div className={cn("mt-2 grid gap-1.5 p-0.5", creator.video ? "grid-cols-6" : "grid-cols-5")}>
          {creator.video && (
            <button className={thumb} aria-label="Play the clip" aria-pressed={onClip} onClick={() => setOnClip(true)}>
              {creator.images[0] && <img src={creator.images[0]} alt="" draggable={false} className="size-full object-cover" />}
              <span className="absolute inset-0 grid place-items-center bg-black/25 text-white"><Play className="size-4 fill-current" /></span>
            </button>
          )}
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i} className={thumb} aria-label={`Photo ${i + 1} of ${count}`} aria-pressed={!onClip && i === index}
              onClick={() => { setIndex(i); setOnClip(false); }}
            >
              {creator.images.length
                ? <img src={creator.images[i]} alt="" draggable={false} className="size-full object-cover" />
                : <span className="grid size-full place-items-center text-[13px] text-muted-foreground">{i + 1}</span>}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-start justify-between gap-3">
          <h2 className="text-[24px] leading-tight font-medium tracking-[-0.02em]">{creator.name}</h2>
          <span className="mt-1"><StageBadge stage={creator.stage} /></span>
        </div>
        <p className="mt-1 text-muted-foreground">{creator.handle} · {nichesOf(creator)} · {placeOf(creator)}</p>
        <p className="mt-3">{creator.bio}</p>

        <Facts creator={creator} className="mt-5 border-y py-4" />
        <p className="mt-3 text-[13px] text-muted-foreground">
          {compact(creator.followers)} followers · largest audience market: {creator.audience.top}
          {" · "}
          {creator.partner
            ? `talent partner ${creator.partner}, ${creator.campaigns} ${creator.campaigns === 1 ? "campaign" : "campaigns"} completed`
            : "no talent partner yet"}
        </p>

        {warning && <Warning text={warning} className="mt-4" />}
        {reason && (
          <p className="mt-4 text-[14px] leading-snug">
            <span className="block text-[13px] text-muted-foreground">Why this match</span>{reason}
          </p>
        )}

        <h3 className="mt-7 mb-2 text-[13px] text-muted-foreground">Recent posts</h3>
        <ol className="grid gap-1.5">
          {creator.captions.map((cap, i) => (
            <li key={i} className={cn("rounded-lg border bg-card px-3 py-2.5", i === matchedPost && "border-foreground")}>
              {i === matchedPost && <span className="mb-0.5 block text-[13px] font-medium">Closest to the brief</span>}
              {cap}
            </li>
          ))}
        </ol>

        <h3 className="mt-7 mb-1 text-[13px] text-muted-foreground">CRM notes</h3>
        <ul>
          {creator.notes.map((n, i) => (
            <li key={i} className="grid grid-cols-[88px_1fr] gap-3 border-t py-2.5 first:border-t-0">
              <span className="text-[13px] leading-[1.75] text-muted-foreground">{NOTE_LABEL[n.kind]}</span>{n.text}
            </li>
          ))}
        </ul>
      </div>

      {/* On a phone the shortlist bar floats over the bottom edge, so the button sits above it. */}
      <footer className="border-t px-5 py-3 max-sm:pb-20">
        <Button
          onClick={onPick} aria-pressed={picked} variant={picked ? "default" : "outline"}
          className="press h-11 w-full justify-between rounded-xl px-4 text-[15px]"
        >
          <span className="flex items-center gap-2">
            {picked ? <Check /> : <Plus />}{picked ? "Shortlisted" : "Add to shortlist"}
          </span>
          <Kbd className={cn(picked && "bg-white/15 text-white")}>S</Kbd>
        </Button>
      </footer>
    </aside>
  );
}
