"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Heart, Play, Plus, Volume2, VolumeX, X } from "lucide-react";
import {
  compact, Facts, FRAME_COUNT, Frames, initials, nichesOf, placeOf, StageBadge, Ticks, useScrub, Warning,
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
 * Everything on file for one creator, laid out like a post on a profile: the
 * photo or clip on the left, and on the right the post it belongs to with its
 * top comments, then the numbers and CRM notes. The arrow keys still move
 * between creators while it is open (the page handles them), and the parent
 * keys this by creator id so it resets on each move.
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
    seen.current = index;
    setOnClip(false);
  }, [index]);

  // The post beside the photo: the caption that photo illustrates, or the first one when there are no photos.
  const post = creator.photoPosts?.[onClip ? 0 : index] ?? Math.min(index, creator.captions.length - 1);
  const reactions = creator.reactions?.[post];
  const others = creator.captions.map((_, i) => i).filter((i) => i !== post);

  const show = (i: number) => { seen.current = i; setIndex(i); setOnClip(false); };
  const thumb = "press relative aspect-square min-w-0 flex-1 overflow-hidden rounded-lg bg-muted ring-offset-2 ring-offset-secondary aria-pressed:ring-2 aria-pressed:ring-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={`Quick look: ${creator.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{ "--h": "min(780px, calc(100dvh - 48px))" } as React.CSSProperties}
        className="flex size-full flex-col overflow-y-auto bg-card sm:h-(--h) sm:max-h-full sm:w-auto sm:max-w-full sm:rounded-2xl md:flex-row md:overflow-hidden"
      >
        {/* Media: the frame takes its width from the dialog's height, so the photo is never cropped or letterboxed. */}
        <div className="flex shrink-0 flex-col gap-2 bg-secondary p-3 md:h-full">
          {onClip && creator.video ? (
            <div className="frame w-full cursor-default! md:h-[calc(var(--h)-96px)] md:w-auto">
              <Clip src={creator.video} poster={creator.images[0]} />
            </div>
          ) : (
            <div className="frame w-full md:h-[calc(var(--h)-96px)] md:w-auto" {...bind}>
              <Frames creator={creator} index={index} loadAll />
              <Ticks count={count} index={index} show />
            </div>
          )}
          {/* Passing the mouse over a thumbnail shows it, like sweeping across the photo itself. */}
          <div className="flex h-[64px] gap-1.5 p-0.5">
            {creator.video && (
              <button
                className={thumb} aria-label="Play the clip" aria-pressed={onClip}
                onClick={() => setOnClip(true)} onPointerEnter={(e) => { if (e.pointerType === "mouse") setOnClip(true); }}
              >
                {creator.images[0] && <img src={creator.images[0]} alt="" draggable={false} className="size-full object-cover" />}
                <span className="absolute inset-0 grid place-items-center bg-black/25 text-white"><Play className="size-4 fill-current" /></span>
              </button>
            )}
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i} className={thumb} aria-label={`Photo ${i + 1} of ${count}`} aria-pressed={!onClip && i === index}
                onClick={() => show(i)} onPointerEnter={(e) => { if (e.pointerType === "mouse") show(i); }}
              >
                {creator.images.length
                  ? <img src={creator.images[i]} alt="" draggable={false} className="size-full object-cover" />
                  : <span className="grid size-full place-items-center text-[13px] text-muted-foreground">{i + 1}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Profile: header, the post with its comments, then what the agency knows. */}
        <div className="flex min-w-0 flex-col md:h-full md:w-[420px]">
          <header className="flex shrink-0 items-center gap-3 border-b px-5 py-3">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-[13px]">
              {creator.images[0] ? <img src={creator.images[0]} alt="" className="size-full object-cover" /> : initials(creator.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-[16px] leading-tight font-medium tracking-[-0.01em]">
                <span className="truncate">{creator.name}</span><StageBadge stage={creator.stage} />
              </h2>
              <p className="truncate text-[13px] text-muted-foreground">{creator.handle} · {nichesOf(creator)} · {placeOf(creator)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close quick look" className="press -mr-2 size-8 text-muted-foreground"><X /></Button>
          </header>

          <div className="min-h-0 flex-1 px-5 py-4 md:overflow-y-auto">
            <p>
              <span className="font-medium">{creator.handle.slice(1)}</span>{" "}{creator.captions[post]}
            </p>
            {post === matchedPost && <p className="mt-1 text-[13px] font-medium">Closest post to the brief</p>}
            {reactions && (
              <>
                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Heart className="size-3.5" aria-hidden="true" />{compact(reactions.likes)} likes · top comments
                </p>
                <ul className="mt-2 grid gap-1.5">
                  {reactions.comments.map((c) => (
                    <li key={c.user} className="text-[14px] leading-snug">
                      <span className="font-medium">{c.user}</span>{" "}<span className="text-foreground/80">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

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

            <h3 className="mt-6 mb-1 text-[13px] text-muted-foreground">CRM notes</h3>
            <ul>
              {creator.notes.map((n, i) => (
                <li key={i} className="grid grid-cols-[84px_1fr] gap-3 border-t py-2 text-[14px] first:border-t-0">
                  <span className="text-[13px] leading-[1.7] text-muted-foreground">{NOTE_LABEL[n.kind]}</span>{n.text}
                </li>
              ))}
            </ul>

            <h3 className="mt-5 mb-2 text-[13px] text-muted-foreground">Other recent posts</h3>
            <ol className="grid gap-1.5">
              {others.map((i) => {
                const photo = creator.photoPosts?.indexOf(i) ?? -1;
                const row = cn("block w-full rounded-lg border px-3 py-2 text-left text-[14px]", i === matchedPost && "border-foreground");
                const text = <>{i === matchedPost && <span className="mb-0.5 block text-[13px] font-medium">Closest to the brief</span>}{creator.captions[i]}</>;
                // A post that has a photo jumps to it; one without is plain text.
                return (
                  <li key={i}>
                    {photo >= 0
                      ? <button className={cn(row, "press hover:border-foreground")} onClick={() => show(photo)}>{text}</button>
                      : <p className={row}>{text}</p>}
                  </li>
                );
              })}
            </ol>
          </div>

          <footer className="flex shrink-0 items-center gap-3 border-t px-5 py-3 max-sm:pb-20">
            <Button
              onClick={onPick} aria-pressed={picked} variant={picked ? "default" : "outline"}
              className="press h-10 flex-1 justify-between rounded-xl px-3.5 text-[15px]"
            >
              <span className="flex items-center gap-2">
                {picked ? <Check /> : <Plus />}{picked ? "Shortlisted" : "Add to shortlist"}
              </span>
              <Kbd className={cn(picked && "bg-white/15 text-white")}>S</Kbd>
            </Button>
            <span className="hidden shrink-0 items-center gap-1 text-[13px] text-muted-foreground sm:flex">
              {position} <Kbd>←</Kbd><Kbd>→</Kbd>
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}
