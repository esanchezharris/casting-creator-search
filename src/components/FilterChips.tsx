"use client";

import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { compact } from "@/components/CreatorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const title = "text-[13px] text-muted-foreground";
const field = "h-9 bg-secondary text-[15px]";

function FollowersEditor({ q, apply }: { q: ParsedQuery; apply: (next: FilterEdit) => void }) {
  const [lo, setLo] = useState(q.minFollowers != null ? compact(q.minFollowers) : "");
  const [hi, setHi] = useState(q.maxFollowers != null ? compact(q.maxFollowers) : "");
  return (
    <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); apply({ ...q, minFollowers: parseCount(lo), maxFollowers: parseCount(hi) }); }}>
      <p className="font-medium">Followers</p>
      <div className="grid grid-cols-2 gap-2">
        <label className={title}>From<Input className={field} value={lo} onChange={(e) => setLo(e.target.value)} placeholder="Any" autoFocus /></label>
        <label className={title}>To<Input className={field} value={hi} onChange={(e) => setHi(e.target.value)} placeholder="Any" /></label>
      </div>
      <p className={title}>Write 50K or 1.2M. Leave a box empty for no limit.</p>
      <Button type="submit" className="press h-9">Apply</Button>
    </form>
  );
}

function PercentEditor({ name, hint, value, apply }: { name: string; hint: string; value: number | null; apply: (v: number | null) => void }) {
  const [text, setText] = useState(value != null ? String(value) : "");
  return (
    <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); const v = parseFloat(text); apply(isFinite(v) && v > 0 ? Math.min(100, v) : null); }}>
      <p className="font-medium">{name}</p>
      <label className={title}>
        At least
        <span className="flex items-center gap-2 text-[15px] text-foreground">
          <Input className={field} value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" placeholder="Any" autoFocus />%
        </span>
      </label>
      <p className={title}>{hint}</p>
      <Button type="submit" className="press h-9">Apply</Button>
    </form>
  );
}

type Kind = "followers" | "engagement" | "audience";

const chip = "inline-flex h-8 items-center rounded-full border bg-card text-[14px] whitespace-nowrap";
const remove = "press mr-1 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";
const option = "press h-7 rounded-full border bg-secondary px-2.5 text-[13px] hover:border-foreground";

/**
 * The parsed query as chips. Every chip can be removed; the number chips open a
 * small editor; "Add filter" adds a creator type, place, stage or number
 * without retyping the brief. Every change goes back out through `onChange`.
 */
export function FilterChips({ parsed: q, places, onChange }: { parsed: ParsedQuery; places: string[]; onChange: (next: FilterEdit) => void }) {
  // Which popover is open: a number chip's editor, or the Add menu (optionally showing a number editor).
  const [open, setOpen] = useState<Kind | "add" | null>(null);
  const [adding, setAdding] = useState<Kind | null>(null);
  const [place, setPlace] = useState("");
  const apply = (next: FilterEdit) => { setOpen(null); setAdding(null); setPlace(""); onChange(next); };

  const has = {
    followers: q.minFollowers != null || q.maxFollowers != null,
    engagement: q.minEngagement != null,
    audience: q.minAudienceUS != null,
  };
  const editors = {
    followers: <FollowersEditor q={q} apply={apply} />,
    engagement: <PercentEditor name="Engagement rate" hint="Likes, comments, saves and shares as a share of followers." value={q.minEngagement} apply={(v) => apply({ ...q, minEngagement: v })} />,
    audience: <PercentEditor name="US audience" hint="Share of followers in the US, wherever the creator lives." value={q.minAudienceUS} apply={(v) => apply({ ...q, minAudienceUS: v == null ? null : Math.round(v) })} />,
  };

  const dim = (s: string) => <span className="text-muted-foreground">{s}</span>;
  const plain = (key: string, label: React.ReactNode, without: FilterEdit) => (
    <span key={key} className={chip}>
      <span className="pr-1.5 pl-3">{label}</span>
      <button className={remove} aria-label="Remove this filter" onClick={() => apply(without)}><X className="size-3.5" /></button>
    </span>
  );
  const editable = (kind: Kind, label: React.ReactNode, without: FilterEdit) => (
    <span key={kind} className={chip}>
      <Popover open={open === kind} onOpenChange={(o) => setOpen(o ? kind : null)}>
        <PopoverTrigger render={<button className="flex h-full items-center gap-1.5 rounded-l-full pr-1.5 pl-3" title="Change" />}>
          <span>{label}</span><ChevronDown className="size-3.5 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-72 p-3.5 text-[15px]">{editors[kind]}</PopoverContent>
      </Popover>
      <button className={remove} aria-label="Remove this filter" onClick={() => apply(without)}><X className="size-3.5" /></button>
    </span>
  );

  const any = q.niches.length || q.locations.length || q.stages.length || has.followers || has.engagement || has.audience || q.semantic;
  const freeNiches = NICHES.filter((n) => !q.niches.includes(n));
  const freeStages = STAGES.filter((s) => !q.stages.includes(s));
  const typed = place.trim().toLowerCase();
  const freePlaces = places
    .filter((p) => !q.locations.some((l) => l.label === p) && (!typed || p.toLowerCase().includes(typed)))
    .slice(0, typed ? 8 : 6);

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5" aria-live="polite">
      {any ? <span className="mr-1 text-[13px] text-muted-foreground">Read as</span> : null}
      {q.stages.map((s) => plain(`st-${s}`, STAGE_CHIP[s], { ...q, stages: q.stages.filter((x) => x !== s) }))}
      {q.niches.map((n) => plain(`n-${n}`, n, { ...q, niches: q.niches.filter((x) => x !== n) }))}
      {q.locations.map((l) => plain(`l-${l.field}-${l.value}`, <>{dim("in")} {l.label}</>, { ...q, locations: q.locations.filter((x) => x !== l) }))}
      {has.followers && editable("followers", <>{followerText(q)} {dim("followers")}</>, { ...q, minFollowers: null, maxFollowers: null })}
      {has.engagement && editable("engagement", <>{q.minEngagement}%+ {dim("engagement")}</>, { ...q, minEngagement: null })}
      {has.audience && editable("audience", <>{q.minAudienceUS}%+ {dim("US audience")}</>, { ...q, minAudienceUS: null })}
      {q.semantic && plain("s", <>{dim("posts about")} {q.semantic}</>, { ...q, semantic: "" })}

      <Popover open={open === "add"} onOpenChange={(o) => { setOpen(o ? "add" : null); if (!o) setAdding(null); }}>
        <PopoverTrigger render={<Button variant="ghost" size="sm" className="press h-8 gap-1 rounded-full px-2.5 text-[14px] text-muted-foreground" />}>
          <Plus className="size-4" /> Add filter
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-80 gap-0 p-3.5 text-[15px]">
          {adding ? editors[adding] : (
            <div className="grid gap-3.5">
              {freeNiches.length > 0 && (
                <div className="grid gap-1.5">
                  <p className={title}>Creator type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {freeNiches.map((n) => <button key={n} className={option} onClick={() => apply({ ...q, niches: [...q.niches, n] })}>{n}</button>)}
                  </div>
                </div>
              )}
              <div className="grid gap-1.5">
                <p className={title}>Where the creator lives</p>
                <Input className={field} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="City, state or country" aria-label="Find a place" />
                <div className="flex flex-wrap gap-1.5">
                  {freePlaces.map((p) => <button key={p} className={option} onClick={() => apply({ ...q, locations: [...q.locations, p] })}>{p}</button>)}
                  {freePlaces.length === 0 && <span className={title}>No creators there in this demo.</span>}
                </div>
              </div>
              {freeStages.length > 0 && (
                <div className="grid gap-1.5">
                  <p className={title}>Pipeline stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {freeStages.map((s) => <button key={s} className={option} onClick={() => apply({ ...q, stages: [...q.stages, s] })}>{STAGE_CHIP[s]}</button>)}
                  </div>
                </div>
              )}
              {(!has.followers || !has.engagement || !has.audience) && (
                <div className="grid gap-1.5">
                  <p className={title}>Numbers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {!has.followers && <button className={option} onClick={() => setAdding("followers")}>followers</button>}
                    {!has.engagement && <button className={option} onClick={() => setAdding("engagement")}>engagement</button>}
                    {!has.audience && <button className={option} onClick={() => setAdding("audience")}>US audience</button>}
                  </div>
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
