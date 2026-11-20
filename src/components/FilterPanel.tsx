"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { compact } from "@/components/CreatorCard";
import { parseCount, type FilterEdit } from "@/components/FilterChips";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NICHES, STAGES, type ParsedQuery, type Stage } from "@/lib/types";

const STAGE_NAME: Record<Stage, string> = { roster: "Roster", applicant: "Applicants", prospect: "Prospects" };

export type Sort = "match" | "reach" | "followers" | "engagement" | "rate";
export const SORTS: [Sort, string][] = [
  ["match", "Best match"], ["reach", "Recent reach"], ["followers", "Followers"],
  ["engagement", "Engagement"], ["rate", "Lowest rate"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-4">
      <h2 className="mb-2.5 text-[13px] font-medium">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A text box that holds its own draft and commits on Enter or when focus
 * leaves, so the grid does not refetch on every keystroke.
 */
function Field({ value, onCommit, label, suffix, ...rest }: {
  value: string; onCommit: (text: string) => void; label: string; suffix?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => { if (text.trim() !== value) onCommit(text.trim()); };
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-muted-foreground">
      <span className="sr-only">{label}</span>
      <Input
        {...rest} value={text} aria-label={label}
        className="h-8 bg-card text-[14px] text-foreground"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      />
      {suffix}
    </label>
  );
}

const row = "press flex h-8 w-full items-center justify-between rounded-lg px-2 text-left text-[14px] hover:bg-muted";
const pill = "press h-7 rounded-full border px-2.5 text-[13px] capitalize";

type Props = {
  parsed: ParsedQuery;
  places: string[];
  sort: Sort;
  onSort: (s: Sort) => void;
  onChange: (next: FilterEdit) => void;
  onReset: () => void;
};

/**
 * The always-visible controls: sort order and every filter the search
 * understands. It edits the same parsed query the brief produced, so typing a
 * brief fills this panel in and changing the panel refines the brief.
 */
export function FilterPanel({ parsed: q, places, sort, onSort, onChange, onReset }: Props) {
  const [place, setPlace] = useState("");
  const typed = place.trim().toLowerCase();
  const suggestions = places
    .filter((p) => !q.locations.some((l) => l.label === p) && (!typed || p.toLowerCase().includes(typed)))
    .slice(0, typed ? 6 : 4);
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const active = q.niches.length + q.locations.length + q.stages.length
    + [q.minFollowers ?? q.maxFollowers, q.minEngagement, q.minAudienceUS, q.semantic || null].filter((v) => v != null).length;

  return (
    <div>
      <section className="pb-4">
        <h2 className="mb-1.5 text-[13px] font-medium">Sort by</h2>
        {SORTS.map(([key, label]) => (
          <button key={key} className={cn(row, sort === key && "bg-muted font-medium")} aria-pressed={sort === key} onClick={() => onSort(key)}>
            {label}{sort === key && <Check className="size-4" />}
          </button>
        ))}
      </section>

      <Section title="Pipeline stage">
        {STAGES.map((s) => {
          const on = q.stages.includes(s);
          return (
            <button key={s} className={row} role="checkbox" aria-checked={on} onClick={() => onChange({ ...q, stages: toggle(q.stages, s) })}>
              <span className="flex items-center gap-2.5">
                <span className={cn("grid size-4 place-items-center rounded-[5px] border border-foreground/40", on && "border-primary bg-primary text-primary-foreground")}>
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                {STAGE_NAME[s]}
              </span>
            </button>
          );
        })}
        <p className="mt-1.5 px-2 text-[13px] text-muted-foreground">None ticked means roster first.</p>
      </Section>

      <Section title="Creator type">
        <div className="flex flex-wrap gap-1.5">
          {NICHES.map((n) => {
            const on = q.niches.includes(n);
            return (
              <button
                key={n} aria-pressed={on} onClick={() => onChange({ ...q, niches: toggle(q.niches, n) })}
                className={cn(pill, on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground")}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Lives in">
        {q.locations.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {q.locations.map((l) => (
              <button
                key={`${l.field}-${l.value}`} aria-label={`Remove ${l.label}`}
                className={cn(pill, "flex items-center gap-1 border-primary bg-primary pr-1.5 text-primary-foreground normal-case")}
                onClick={() => onChange({ ...q, locations: q.locations.filter((x) => x !== l) })}
              >
                {l.label}<X className="size-3.5" />
              </button>
            ))}
          </div>
        )}
        <Input
          className="h-8 bg-card text-[14px]" value={place} placeholder="City, state or country" aria-label="Find a place"
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) { onChange({ ...q, locations: [...q.locations, suggestions[0]] }); setPlace(""); } }}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((p) => (
            <button key={p} className={cn(pill, "bg-card normal-case hover:border-foreground")} onClick={() => { onChange({ ...q, locations: [...q.locations, p] }); setPlace(""); }}>
              {p}
            </button>
          ))}
          {suggestions.length === 0 && <span className="text-[13px] text-muted-foreground">No creators there in this demo.</span>}
        </div>
      </Section>

      <Section title="Followers">
        <div className="flex items-center gap-2">
          <Field label="Followers from" placeholder="Min" value={q.minFollowers != null ? compact(q.minFollowers) : ""} onCommit={(t) => onChange({ ...q, minFollowers: parseCount(t) })} />
          <span className="text-[13px] text-muted-foreground">to</span>
          <Field label="Followers to" placeholder="Max" value={q.maxFollowers != null ? compact(q.maxFollowers) : ""} onCommit={(t) => onChange({ ...q, maxFollowers: parseCount(t) })} />
        </div>
      </Section>

      <Section title="Minimum engagement">
        <Field
          label="Minimum engagement rate" placeholder="Any" suffix="%" inputMode="decimal"
          value={q.minEngagement != null ? String(q.minEngagement) : ""}
          onCommit={(t) => { const v = parseFloat(t); onChange({ ...q, minEngagement: isFinite(v) && v > 0 ? Math.min(100, v) : null }); }}
        />
      </Section>

      <Section title="Minimum US audience">
        <Field
          label="Minimum share of audience in the US" placeholder="Any" suffix="%" inputMode="decimal"
          value={q.minAudienceUS != null ? String(q.minAudienceUS) : ""}
          onCommit={(t) => { const v = parseFloat(t); onChange({ ...q, minAudienceUS: isFinite(v) && v > 0 ? Math.min(100, Math.round(v)) : null }); }}
        />
        <p className="mt-1.5 text-[13px] text-muted-foreground">Where the audience is, not where the creator lives.</p>
      </Section>

      <Section title="Posts about">
        <Field label="Topic the creator posts about" placeholder="e.g. energy drinks" value={q.semantic} onCommit={(t) => onChange({ ...q, semantic: t })} />
      </Section>

      {active > 0 && (
        <button className="press mb-2 h-8 w-full rounded-lg border bg-card text-[14px] hover:border-foreground" onClick={onReset}>
          Clear {active} {active === 1 ? "filter" : "filters"}
        </button>
      )}
    </div>
  );
}
