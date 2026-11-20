"use client";

import { compact, Facts, FRAME_COUNT, Frames, PhotoCredit, PickButton, placeOf, STAGE_LABEL, Ticks, useScrub } from "@/components/CreatorCard";
import type { SearchResult } from "@/lib/types";

const NOTE_LABEL = { reliability: "Reliability", terms: "Terms", conflict: "Conflict", status: "Status" };

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

  return (
    <aside className="look" role="dialog" aria-label={`Quick look: ${creator.name}`}>
      <header>
        <span className="label">Quick look · {position}</span>
        <button className="close" onClick={onClose}><kbd>Esc</kbd> Close</button>
      </header>

      <div className="look-body">
        <div className="frame" {...bind}>
          <Frames creator={creator} index={index} loadAll />
          <Ticks count={count} index={index} />
        </div>
        <div className="thumbs">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} aria-label={`Photo ${i + 1} of ${count}`} aria-pressed={i === index} onClick={() => setIndex(i)}>
              {creator.images.length
                ? <img src={creator.images[i]} alt="" draggable={false} />
                : <span className="ph on" data-i={i}>{i + 1}</span>}
            </button>
          ))}
        </div>
        <PhotoCredit creator={creator} />

        <div className="who">
          <div className="who-top">
            <h2>{creator.name}</h2>
            <span className={`badge ${creator.stage}`}>{STAGE_LABEL[creator.stage]}</span>
          </div>
          <p>{creator.handle} · {placeOf(creator)}</p>
          <p>
            {creator.partner
              ? `Talent partner: ${creator.partner} · ${creator.campaigns} ${creator.campaigns === 1 ? "campaign" : "campaigns"} completed`
              : "No talent partner yet"}
          </p>
        </div>
        <p className="bio">{creator.bio}</p>

        <Facts creator={creator} />
        <p className="more-facts">
          {compact(creator.followers)} followers · largest audience market: {creator.audience.top}
        </p>

        {warning && <p className="warn"><span>Check before pitching</span>{warning}</p>}
        {reason && <p className="why"><span>Why this match</span>{reason}</p>}

        <h3 className="label">Recent posts</h3>
        <ol className="posts">
          {creator.captions.map((cap, i) => (
            <li key={i} className={i === matchedPost ? "match" : ""}>
              {i === matchedPost && <span className="label">Closest to the brief</span>}
              {cap}
            </li>
          ))}
        </ol>

        <h3 className="label">CRM notes</h3>
        <ul className="notes">
          {creator.notes.map((n, i) => (
            <li key={i}><span>{NOTE_LABEL[n.kind]}</span>{n.text}</li>
          ))}
        </ul>
      </div>

      <footer><PickButton picked={picked} onPick={onPick} /></footer>
    </aside>
  );
}
