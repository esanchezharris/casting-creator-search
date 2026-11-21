"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Heart, Play, Plus, X } from "lucide-react";
import {
  Clip, compact, Facts, FRAME_COUNT, Frames, initials, nichesOf, placeOf, StageBadge, useScrub, Warning,
} from "@/components/CreatorCard";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useElastic } from "@/lib/elastic";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/types";

const NOTE_LABEL = { reliability: "Reliability", terms: "Terms", conflict: "Conflict", status: "Status" };

type PostSort = "recent" | "popular";
const POST_SORTS = [["recent", "Recent"], ["popular", "Popular"]] as const;

const ago = (days: number) =>
  days < 14 ? `${days} ${days === 1 ? "day" : "days"} ago` : `${Math.round(days / 7)} weeks ago`;

type Props = {
  result: SearchResult;
  position: string;
  picked: boolean;
  onPick: () => void;
  onClose: () => void;
  /** The post to open on: the frame the card behind was showing. */
  start: number;
};

/**
 * Everything on file for one creator, laid out like a post on a profile: the
 * photo or clip on the left, and on the right the post it belongs to with its
 * top comments, then the numbers and CRM notes. Posts run newest first, or
 * most liked first; that order is separate from how the grid behind is sorted.
 * The arrow keys still move between creators while it is open (the page
 * handles them), and the parent keys this by creator id so it resets on each
 * move.
 */
export function QuickLook({ result, position, picked, onPick, onClose, start }: Props) {
  const { creator, reason, warning, matchedPost } = result;
  const count = creator.images.length || FRAME_COUNT;
  // The big photo does not follow the mouse here; the thumbnails and the , and . keys change it.
  const { index, setIndex } = useScrub(count, true, start);
  const [sort, setSort] = useState<PostSort>("recent");

  const postOf = (photo: number) => creator.photoPosts?.[photo] ?? Math.min(photo, creator.captions.length - 1);
  const likes = (post: number) => creator.reactions?.[post]?.likes ?? 0;
  const days = (post: number) => creator.postDays?.[post] ?? post;

  // `images` is already newest first. Popular reorders the same photos by likes on their post.
  const order = useMemo(() => {
    const photos = Array.from({ length: count }, (_, i) => i);
    if (sort === "popular") photos.sort((a, b) => likes(postOf(b)) - likes(postOf(a)));
    return photos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator, count, sort]);

  const photo = order[index];
  const post = postOf(photo);
  const reactions = creator.reactions?.[post];
  const clipAt = creator.video && creator.videoAt != null ? order.indexOf(creator.videoAt) : -1;
  const others = creator.captions.map((_, i) => i).filter((i) => i !== post)
    .sort((a, b) => (sort === "popular" ? likes(b) - likes(a) : days(a) - days(b)));

  // The strip follows the photo on show, except when the mouse is what chose it.
  const strip = useElastic<HTMLDivElement>("x");
  const profile = useElastic<HTMLDivElement>("y");
  const byThumb = useRef(false);
  useEffect(() => {
    const scroller = strip.current?.parentElement;
    const thumb = strip.current?.querySelectorAll("button")[index];
    if (!scroller || !thumb || byThumb.current) { byThumb.current = false; return; }
    const left = thumb.offsetLeft - 8, right = thumb.offsetLeft + thumb.offsetWidth + 8;
    if (left < scroller.scrollLeft) scroller.scrollLeft = left;
    else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
  }, [index, strip]);

  const show = (i: number, thumb = false) => { byThumb.current = thumb; setIndex(i); };
  // Scrolling the strip slides thumbnails under a mouse that is not moving. Only a real
  // movement of the mouse picks a thumbnail, so nothing changes until the hand does.
  const mouse = useRef({ x: -1, y: -1 });
  const moved = (e: React.PointerEvent) => {
    const same = e.screenX === mouse.current.x && e.screenY === mouse.current.y;
    mouse.current = { x: e.screenX, y: e.screenY };
    return !same;
  };
  const resort = (next: PostSort) => {
    setSort(next); setIndex(0);
    if (profile.current?.parentElement) profile.current.parentElement.scrollTop = 0;
  };

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
          <div className="frame w-full cursor-default! md:h-[calc(var(--h)-136px)] md:w-auto">
            <Frames creator={creator} index={index} loadAll order={order} />
            {creator.video && <Clip src={creator.video} active={index === clipAt} sound />}
          </div>

          <div className="flex h-7 items-center justify-between gap-3 pl-1">
            <span className="text-[13px] text-muted-foreground tabular-nums">{index + 1} of {count} posts</span>
            {creator.images.length > 0 && <Segmented label="Order posts by" value={sort} options={POST_SORTS} onChange={resort} />}
          </div>

          {/* Passing the mouse over a thumbnail shows it, like sweeping across the photo itself. A long history scrolls sideways. */}
          <div className="-mx-1.5 -mb-1 h-[72px] w-0 min-w-[calc(100%+12px)] overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
            <div ref={strip} className="w-max">
              {/* The padding is room for the ring around the thumbnail on show. */}
              <div className="flex gap-1.5 p-1.5">
                {order.map((p, i) => (
                  <button
                    key={p} aria-pressed={i === index}
                    aria-label={i === clipAt ? `Clip, post ${i + 1} of ${count}` : `Photo, post ${i + 1} of ${count}`}
                    className="press relative size-[60px] shrink-0 overflow-hidden rounded-lg bg-muted ring-offset-2 ring-offset-secondary aria-pressed:ring-2 aria-pressed:ring-foreground"
                    onClick={() => show(i, true)} onPointerMove={(e) => { if (e.pointerType === "mouse" && moved(e) && i !== index) show(i, true); }}
                  >
                    {creator.images.length
                      ? <img src={creator.images[p]} alt="" draggable={false} className="size-full object-cover" />
                      : <span className="grid size-full place-items-center text-[13px] text-muted-foreground">{i + 1}</span>}
                    {i === clipAt && <span className="absolute inset-0 grid place-items-center bg-black/25 text-white"><Play className="size-4 fill-current" /></span>}
                  </button>
                ))}
              </div>
            </div>
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

          <div className="min-h-0 flex-1 md:overflow-y-auto">
            <div ref={profile}>
              <div className="px-5 py-4">
                <p>
                  <span className="font-medium">{creator.handle.slice(1)}</span>{" "}{creator.captions[post]}
                </p>
                {post === matchedPost && <p className="mt-1 text-[13px] font-medium">Closest post to the brief</p>}
                {reactions && (
                  <>
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Heart className="size-3.5" aria-hidden="true" />{compact(reactions.likes)} likes
                      {creator.postDays && ` · ${ago(days(post))}`}{index === clipAt && " · clip"}
                    </p>
                    <ul className="mt-2.5 grid gap-1.5">
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
                  Age {creator.age} · {compact(creator.followers)} followers · largest audience market: {creator.audience.top}
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

                <h3 className="mt-5 mb-2 text-[13px] text-muted-foreground">
                  Other posts, {sort === "popular" ? "most liked first" : "newest first"}
                </h3>
                <ol className="grid gap-1.5">
                  {others.map((i) => {
                    const at = order.indexOf(creator.photoPosts?.indexOf(i) ?? -1);
                    const row = cn("block w-full rounded-lg border px-3 py-2 text-left text-[14px]", i === matchedPost && "border-foreground");
                    const text = (
                      <>
                        <span className="mb-0.5 block text-[13px] text-muted-foreground tabular-nums">
                          {i === matchedPost && <span className="font-medium text-foreground">Closest to the brief · </span>}
                          {compact(likes(i))} likes{creator.postDays && ` · ${ago(days(i))}`}
                        </span>
                        {creator.captions[i]}
                      </>
                    );
                    // A post that has a photo jumps to it; one without is plain text.
                    return (
                      <li key={i}>
                        {at >= 0
                          ? <button className={cn(row, "press hover:border-foreground")} onClick={() => show(at)}>{text}</button>
                          : <p className={row}>{text}</p>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
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
