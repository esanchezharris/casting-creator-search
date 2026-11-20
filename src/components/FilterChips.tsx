"use client";

import { useEffect, useRef, useState } from "react";
import { compact } from "@/components/CreatorCard";
import { NICHES, STAGES, type LocationFilter, type ParsedQuery, type Stage } from "@/lib/types";

/** What the chips send back. A place added by hand is just its name; the server resolves it. */
export type FilterEdit = Omit<ParsedQuery, "locations"> & { locations: (LocationFilter | string)[] };

const STAGE_CHIP: Record<Stage, string> = { roster: "on the roster", applicant: "applicants", prospect: "prospects" };

const followerText = (q: ParsedQuery) =>
  q.minFollowers != null && q.maxFollowers != null ? `${compact(q.minFollowers)} to ${compact(q.maxFollowers)}`
  : q.minFollowers != null ? `over ${compact(q.minFollowers)}` : `under ${compact(q.maxFollowers!)}`;

/** The filters as one plain sentence, for the shortlist's first line when chips were edited by hand. */
export function summarize(q: ParsedQuery): string {
  const parts: string[] = [];
  if (q.stages.length) parts.push(q.stages.map((s) => STAGE_CHIP[s]).join(" or "));
  if (q.niches.length) parts.push(q.niches.join(" or "));
  if (q.locations.length) parts.push(`in ${q.locations.map((l) => l.label).join(" or ")}`);
  if (q.minFollowers != null || q.maxFollowers != null) parts.push(`${followerText(q)} followers`);
  if (q.minEngagement != null) parts.push(`${q.minEngagement}%+ engagement`);
  if (q.minAudienceUS != null) parts.push(`${q.minAudienceUS}%+ US audience`);
  if (q.semantic) parts.push(`posts about ${q.semantic}`);
  return parts.join(", ");
}

/** "50K", "1.2m", "50,000" or "50000". Empty or unreadable means no limit. */
export function parseCount(s: string): number | null {
  const m = s.trim().toLowerCase().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*(k|m)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1);
  return v > 0 ? Math.round(v) : null;
}

function Popover({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The wrapper holds the trigger too, so clicking the trigger again is not an "outside" click.
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key, true); };
  }, [onClose]);
  return <div ref={ref} className="pop" role="dialog" aria-label={label}>{children}</div>;
}

function FollowersEditor({ q, apply }: { q: ParsedQuery; apply: (next: FilterEdit) => void }) {
  const [lo, setLo] = useState(q.minFollowers != null ? compact(q.minFollowers) : "");
  const [hi, setHi] = useState(q.maxFollowers != null ? compact(q.maxFollowers) : "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); apply({ ...q, minFollowers: parseCount(lo), maxFollowers: parseCount(hi) }); }}>
      <p className="pop-title">Followers</p>
      <div className="pop-row">
        <label>From<input value={lo} onChange={(e) => setLo(e.target.value)} placeholder="Any" autoFocus /></label>
        <label>To<input value={hi} onChange={(e) => setHi(e.target.value)} placeholder="Any" /></label>
      </div>
      <p className="pop-hint">Write 50K or 1.2M. Leave a box empty for no limit.</p>
      <button className="go" type="submit">Apply</button>
    </form>
  );
}

function PercentEditor({ title, hint, value, apply }: { title: string; hint: string; value: number | null; apply: (v: number | null) => void }) {
  const [text, setText] = useState(value != null ? String(value) : "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); const v = parseFloat(text); apply(isFinite(v) && v > 0 ? Math.min(100, v) : null); }}>
      <p className="pop-title">{title}</p>
      <div className="pop-row">
        <label>At least<span className="pct"><input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" placeholder="Any" autoFocus />%</span></label>
      </div>
      <p className="pop-hint">{hint}</p>
      <button className="go" type="submit">Apply</button>
    </form>
  );
}

type Open = "followers" | "engagement" | "audience" | "add" | null;

/**
 * The parsed query as chips. Every chip can be removed; the number chips open a
 * small editor; "Add filter" adds a creator type, place, stage or number
 * without retyping the brief. Every change goes back out through `onChange`.
 */
export function FilterChips({ parsed: q, places, onChange }: { parsed: ParsedQuery; places: string[]; onChange: (next: FilterEdit) => void }) {
  const [open, setOpen] = useState<Open>(null);
  const [place, setPlace] = useState("");
  const close = () => setOpen(null);
  const apply = (next: FilterEdit) => { setOpen(null); setPlace(""); onChange(next); };

  const hasFollowers = q.minFollowers != null || q.maxFollowers != null;
  const editors = {
    followers: <FollowersEditor q={q} apply={apply} />,
    engagement: <PercentEditor title="Engagement rate" hint="Likes, comments, saves and shares as a share of followers." value={q.minEngagement} apply={(v) => apply({ ...q, minEngagement: v })} />,
    audience: <PercentEditor title="US audience" hint="Share of followers in the US, wherever the creator lives." value={q.minAudienceUS} apply={(v) => apply({ ...q, minAudienceUS: v == null ? null : Math.round(v) })} />,
  };
  const has = { followers: hasFollowers, engagement: q.minEngagement != null, audience: q.minAudienceUS != null };

  const plain = (key: string, label: React.ReactNode, remove: FilterEdit) => (
    <span key={key} className="chip">
      <span>{label}</span>
      <button className="x" aria-label="Remove this filter" onClick={() => apply(remove)}>×</button>
    </span>
  );
  const editable = (kind: "followers" | "engagement" | "audience", label: React.ReactNode, remove: FilterEdit) => (
    <span key={kind} className="chip-wrap">
      <span className="chip">
        <button className="edit" aria-expanded={open === kind} title="Change" onClick={() => setOpen(open === kind ? null : kind)}>
          {label}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="x" aria-label="Remove this filter" onClick={() => apply(remove)}>×</button>
      </span>
      {open === kind && <Popover label="Change this filter" onClose={close}>{editors[kind]}</Popover>}
    </span>
  );

  const any = q.niches.length || q.locations.length || q.stages.length || hasFollowers || has.engagement || has.audience || q.semantic;
  const freeNiches = NICHES.filter((n) => !q.niches.includes(n));
  const freeStages = STAGES.filter((s) => !q.stages.includes(s));
  const typed = place.trim().toLowerCase();
  const freePlaces = places
    .filter((p) => !q.locations.some((l) => l.label === p) && (!typed || p.toLowerCase().includes(typed)))
    .slice(0, typed ? 8 : 6);
  // A number filter with no chip yet is edited from under the Add button.
  const fromAdd = open && open !== "add" && !has[open] ? open : null;

  return (
    <div className="reading" aria-live="polite">
      <span className="label">{any ? "Read as" : "Filters"}</span>
      {q.stages.map((s) => plain(`st-${s}`, STAGE_CHIP[s], { ...q, stages: q.stages.filter((x) => x !== s) }))}
      {q.niches.map((n) => plain(`n-${n}`, n, { ...q, niches: q.niches.filter((x) => x !== n) }))}
      {q.locations.map((l) => plain(`l-${l.field}-${l.value}`, <><em>in</em> {l.label}</>, { ...q, locations: q.locations.filter((x) => x !== l) }))}
      {hasFollowers && editable("followers", <>{followerText(q)} <em>followers</em></>, { ...q, minFollowers: null, maxFollowers: null })}
      {has.engagement && editable("engagement", <>{q.minEngagement}%+ <em>engagement</em></>, { ...q, minEngagement: null })}
      {has.audience && editable("audience", <>{q.minAudienceUS}%+ <em>US audience</em></>, { ...q, minAudienceUS: null })}
      {q.semantic && plain("s", <><em>posts about</em> {q.semantic}</>, { ...q, semantic: "" })}

      <span className="chip-wrap">
        <button className="add" aria-expanded={open === "add"} onClick={() => setOpen(open === "add" ? null : "add")}>
          <span aria-hidden="true">+</span> Add filter
        </button>
        {fromAdd && <Popover label="Add a filter" onClose={close}>{editors[fromAdd]}</Popover>}
        {open === "add" && (
          <Popover label="Add a filter" onClose={close}>
            {freeNiches.length > 0 && <>
              <p className="pop-title">Creator type</p>
              <div className="opts">
                {freeNiches.map((n) => <button key={n} onClick={() => apply({ ...q, niches: [...q.niches, n] })}>{n}</button>)}
              </div>
            </>}
            <p className="pop-title">Where the creator lives</p>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="City, state or country" aria-label="Find a place" />
            <div className="opts">
              {freePlaces.map((p) => <button key={p} onClick={() => apply({ ...q, locations: [...q.locations, p] })}>{p}</button>)}
              {freePlaces.length === 0 && <span className="pop-hint">No creators there in this demo.</span>}
            </div>
            <p className="pop-title">Pipeline stage</p>
            <div className="opts">
              {freeStages.map((s) => <button key={s} onClick={() => apply({ ...q, stages: [...q.stages, s] })}>{STAGE_CHIP[s]}</button>)}
            </div>
            {(!has.followers || !has.engagement || !has.audience) && <>
              <p className="pop-title">Numbers</p>
              <div className="opts">
                {!has.followers && <button onClick={() => setOpen("followers")}>followers</button>}
                {!has.engagement && <button onClick={() => setOpen("engagement")}>engagement</button>}
                {!has.audience && <button onClick={() => setOpen("audience")}>US audience</button>}
              </div>
            </>}
          </Popover>
        )}
      </span>
    </div>
  );
}
