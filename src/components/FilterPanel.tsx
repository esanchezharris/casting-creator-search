"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { compact } from "@/components/CreatorCard";
import { parseCount, type FilterEdit } from "@/components/FilterChips";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { GENDERS, NICHES, STAGES, type Gender, type ParsedQuery, type Stage } from "@/lib/types";

const STAGE_NAME: Record<Stage, string> = { roster: "Roster", applicant: "Applicants", prospect: "Prospects" };
const GENDER_NAME: Record<Gender, string> = { woman: "Women", man: "Men" };

export type Sort = "match" | "reach" | "followers" | "engagement" | "rate";
export const SORTS: [Sort, string][] = [
  ["match", "Best match"], ["reach", "Recent reach"], ["followers", "Followers"],
  ["engagement", "Engagement"], ["rate", "Lowest rate"],
];

/** How many filters are set, for the badge on the button that reopens the panel. */
export const activeCount = (q: ParsedQuery) =>
  q.niches.length + q.locations.length + q.stages.length + q.genders.length
  + [q.minAge ?? q.maxAge, q.minFollowers ?? q.maxFollowers, q.maxRate, q.minEngagement, q.minAudienceUS, q.semantic || null].filter((v) => v != null).length;

// The follower slider is logarithmic, because the roster runs from a few thousand to about a
// million and the interesting differences are at the small end. Either end stop means "no limit".
const F_MIN = 5_000, F_MAX = 1_000_000, F_STEPS = 100;
const toFollowers = (t: number) => {
  const v = F_MIN * Math.pow(F_MAX / F_MIN, t / F_STEPS);
  const unit = v < 10_000 ? 500 : v < 100_000 ? 5_000 : 50_000;
  return Math.round(v / unit) * unit;
};
const toStop = (v: number | null, fallback: number) =>
  v == null ? fallback : Math.max(0, Math.min(F_STEPS, Math.round((Math.log(v / F_MIN) / Math.log(F_MAX / F_MIN)) * F_STEPS)));

// The age slider's end stops mean "no limit", like the follower slider's.
const A_MIN = 18, A_MAX = 45;
const parseAge = (t: string) => { const n = parseInt(t, 10); return isFinite(n) && n > 0 ? Math.max(16, Math.min(80, n)) : null; };

function Section({ title, value, children }: { title: string; value?: string; children: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-3.5 last:border-b-0">
      <h2 className="mb-2 flex items-baseline justify-between text-[13px] font-medium">
        {title}
        {value && <span className="font-normal text-muted-foreground tabular-nums">{value}</span>}
      </h2>
      {children}
    </section>
  );
}

/** A tick-box row with the number of creators in the database that carry the value. */
function Option({ label, count, checked, onToggle }: { label: string; count?: number; checked: boolean; onToggle: () => void }) {
  return (
    <label className="-mx-1.5 flex h-7 cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-[14px] hover:bg-muted/60">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="border-foreground/35 bg-card" />
      <span className="flex-1 capitalize">{label}</span>
      {count != null && <span className="text-[13px] text-muted-foreground tabular-nums">{count}</span>}
    </label>
  );
}

/** A small text box that holds its own draft and commits on Enter or when focus leaves. */
function Typed({ value, onCommit, label, suffix, ...rest }: {
  value: string; onCommit: (text: string) => void; label: string; suffix?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => { if (text.trim() !== value) onCommit(text.trim()); };
  return (
    <span className="relative block">
      <Input
        {...rest} value={text} aria-label={label}
        className={`h-7 rounded-md bg-card px-2 text-[13px] tabular-nums ${suffix ? "pr-6" : ""}`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[13px] text-muted-foreground">{suffix}</span>}
    </span>
  );
}

/** One-thumb "at least" slider with a typed box. Zero means no minimum. */
function MinSlider({ title, value, max, step, hint, label, onCommit }: {
  title: string; value: number | null; max: number; step: number; hint?: string; label: string; onCommit: (v: number | null) => void;
}) {
  const [drag, setDrag] = useState(value ?? 0);
  useEffect(() => setDrag(value ?? 0), [value]);
  return (
    <Section title={title} value={drag > 0 ? `${drag}% or more` : "Any"}>
      <div className="flex items-center gap-3">
        <Slider
          labels={[label]} className="flex-1" min={0} max={max} step={step} value={[drag]}
          onValueChange={(v) => setDrag((v as number[])[0])}
          onValueCommitted={(v) => onCommit((v as number[])[0] > 0 ? (v as number[])[0] : null)}
        />
        <span className="w-[58px] shrink-0">
          <Typed
            label={`${label}, typed`} placeholder="Any" suffix="%" inputMode="decimal" value={value != null ? String(value) : ""}
            onCommit={(t) => { const n = parseFloat(t); onCommit(isFinite(n) && n > 0 ? Math.min(100, n) : null); }}
          />
        </span>
      </div>
      {hint && <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{hint}</p>}
    </Section>
  );
}

type Props = {
  parsed: ParsedQuery;
  places: string[];
  facets: Record<string, number>;
  onChange: (next: FilterEdit) => void;
};

/**
 * Every filter the search understands, always in the same place. It edits the
 * same parsed query a typed brief produces, so a brief fills this panel in and
 * changing the panel refines the brief.
 */
export function FilterPanel({ parsed: q, places, facets, onChange }: Props) {
  const [place, setPlace] = useState("");
  const typed = place.trim().toLowerCase();
  const suggestions = places
    .filter((p) => !q.locations.some((l) => l.label === p) && (!typed || p.toLowerCase().includes(typed)))
    .slice(0, typed ? 6 : 4);
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const [range, setRange] = useState([toStop(q.minFollowers, 0), toStop(q.maxFollowers, F_STEPS)]);
  useEffect(() => setRange([toStop(q.minFollowers, 0), toStop(q.maxFollowers, F_STEPS)]), [q.minFollowers, q.maxFollowers]);
  const lo = range[0] <= 0 ? null : toFollowers(range[0]);
  const hi = range[1] >= F_STEPS ? null : toFollowers(range[1]);
  const followerText = lo == null && hi == null ? "Any"
    : lo != null && hi != null ? `${compact(lo)} to ${compact(hi)}` : lo != null ? `${compact(lo)} or more` : `Up to ${compact(hi!)}`;

  const [ages, setAges] = useState([q.minAge ?? A_MIN, q.maxAge ?? A_MAX]);
  useEffect(() => setAges([q.minAge ?? A_MIN, q.maxAge ?? A_MAX]), [q.minAge, q.maxAge]);
  const young = ages[0] <= A_MIN ? null : ages[0], old = ages[1] >= A_MAX ? null : ages[1];
  const ageLabel = young == null && old == null ? "Any"
    : young != null && old != null ? `${young} to ${old}` : young != null ? `${young} or over` : `${old} or under`;

  // Rate: the right end stop means no limit.
  const R_MAX = 20_000;
  const [rate, setRate] = useState(q.maxRate ?? R_MAX);
  useEffect(() => setRate(q.maxRate ?? R_MAX), [q.maxRate]);

  const pill = "press h-7 rounded-md border bg-card px-2 text-[13px] hover:border-foreground";

  return (
    <div>
      <Section title="Pipeline stage">
        {STAGES.map((s) => (
          <Option key={s} label={STAGE_NAME[s]} count={facets[`stage:${s}`]} checked={q.stages.includes(s)} onToggle={() => onChange({ ...q, stages: toggle(q.stages, s) })} />
        ))}
        <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">With none ticked, everyone is shown. A brief with a topic lists the roster first.</p>
      </Section>

      <Section title="Creator type">
        {NICHES.map((n) => (
          <Option key={n} label={n} count={facets[`niche:${n}`]} checked={q.niches.includes(n)} onToggle={() => onChange({ ...q, niches: toggle(q.niches, n) })} />
        ))}
      </Section>

      <Section title="Gender">
        {GENDERS.map((g) => (
          <Option key={g} label={GENDER_NAME[g]} count={facets[`gender:${g}`]} checked={q.genders.includes(g)} onToggle={() => onChange({ ...q, genders: toggle(q.genders, g) })} />
        ))}
      </Section>

      <Section title="Age" value={ageLabel}>
        <Slider
          labels={["Youngest", "Oldest"]} min={A_MIN} max={A_MAX} step={1} value={ages}
          onValueChange={(v) => setAges(v as number[])}
          onValueCommitted={(v) => {
            const [a, b] = v as number[];
            onChange({ ...q, minAge: a <= A_MIN ? null : a, maxAge: b >= A_MAX ? null : b });
          }}
        />
        <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[13px] text-muted-foreground">
          <Typed label="Age from" placeholder="Min" inputMode="numeric" value={q.minAge != null ? String(q.minAge) : ""} onCommit={(t) => onChange({ ...q, minAge: parseAge(t) })} />
          to
          <Typed label="Age to" placeholder="Max" inputMode="numeric" value={q.maxAge != null ? String(q.maxAge) : ""} onCommit={(t) => onChange({ ...q, maxAge: parseAge(t) })} />
        </div>
      </Section>

      <Section title="Followers" value={followerText}>
        <Slider
          labels={["Fewest followers", "Most followers"]} min={0} max={F_STEPS} step={1} value={range}
          onValueChange={(v) => setRange(v as number[])}
          onValueCommitted={(v) => {
            const [a, b] = v as number[];
            onChange({ ...q, minFollowers: a <= 0 ? null : toFollowers(a), maxFollowers: b >= F_STEPS ? null : toFollowers(b) });
          }}
        />
        <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[13px] text-muted-foreground">
          <Typed label="Followers from" placeholder="Min" value={q.minFollowers != null ? compact(q.minFollowers) : ""} onCommit={(t) => onChange({ ...q, minFollowers: parseCount(t) })} />
          to
          <Typed label="Followers to" placeholder="Max" value={q.maxFollowers != null ? compact(q.maxFollowers) : ""} onCommit={(t) => onChange({ ...q, maxFollowers: parseCount(t) })} />
        </div>
      </Section>

      <Section title="Rate per reel" value={rate >= R_MAX ? "Any" : `Up to $${compact(rate)}`}>
        <div className="flex items-center gap-3">
          <Slider
            labels={["Highest rate per reel"]} className="flex-1" min={500} max={R_MAX} step={500} value={[rate]}
            onValueChange={(v) => setRate((v as number[])[0])}
            onValueCommitted={(v) => onChange({ ...q, maxRate: (v as number[])[0] >= R_MAX ? null : (v as number[])[0] })}
          />
          <span className="w-[68px] shrink-0">
            <Typed
              label="Highest rate per reel, typed" placeholder="Any" value={q.maxRate != null ? `$${compact(q.maxRate)}` : ""}
              onCommit={(t) => onChange({ ...q, maxRate: parseCount(t.replace("$", "")) })}
            />
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">Only roster creators have an agreed rate. The others are not ruled out by it.</p>
      </Section>

      <MinSlider
        title="Engagement rate" label="Minimum engagement rate" max={10} step={0.5} value={q.minEngagement}
        onCommit={(v) => onChange({ ...q, minEngagement: v })}
      />

      <MinSlider
        title="US audience" label="Minimum share of audience in the US" max={100} step={5} value={q.minAudienceUS}
        hint="Where the followers are, not where the creator lives."
        onCommit={(v) => onChange({ ...q, minAudienceUS: v == null ? null : Math.round(v) })}
      />

      <Section title="Lives in">
        {q.locations.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {q.locations.map((l) => (
              <button
                key={`${l.field}-${l.value}`} aria-label={`Remove ${l.label}`}
                className="press flex h-7 items-center gap-1 rounded-md bg-primary pr-1.5 pl-2 text-[13px] text-primary-foreground"
                onClick={() => onChange({ ...q, locations: q.locations.filter((x) => x !== l) })}
              >
                {l.label}<X className="size-3.5" />
              </button>
            ))}
          </div>
        )}
        <Input
          className="h-8 rounded-md bg-card px-2 text-[14px]" value={place} placeholder="City, state or country" aria-label="Find a place"
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) { onChange({ ...q, locations: [...q.locations, suggestions[0]] }); setPlace(""); } }}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((p) => (
            <button key={p} className={pill} onClick={() => { onChange({ ...q, locations: [...q.locations, p] }); setPlace(""); }}>{p}</button>
          ))}
          {suggestions.length === 0 && <span className="text-[13px] text-muted-foreground">No creators there in this demo.</span>}
        </div>
      </Section>

      <Section title="Posts about">
        <Typed label="Topic the creator posts about" placeholder="e.g. energy drinks" value={q.semantic} onCommit={(t) => onChange({ ...q, semantic: t })} />
      </Section>
    </div>
  );
}
