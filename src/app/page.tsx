"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreatorCard, compact } from "@/components/CreatorCard";
import type { Creator, ParsedQuery, SearchResponse, SearchResult } from "@/lib/types";

const EXAMPLES = [
  "Fitness creators in Florida under 100K who post about energy drinks",
  "Micro beauty creators with engagement over 5%",
  "Runners who review shoes",
  "Skincare in New York or Los Angeles, 50K+, sunscreen",
];

type Sort = "match" | "followers" | "engagement" | "rate";
const SORTS: [Sort, string][] = [["match", "Best match"], ["followers", "Followers"], ["engagement", "Engagement"], ["rate", "Lowest rate"]];

const PARSER_LABEL = { llm: "Read by the language model", rules: "Read by the rule parser", chips: "Filters edited by hand" };
const RANKER_LABEL = { embeddings: "ranked by meaning", keywords: "ranked by keywords", followers: "ordered by followers" };

type Chip = { key: string; label: React.ReactNode; topic?: boolean; remove: (q: ParsedQuery) => ParsedQuery };

function chipsFor(q: ParsedQuery): Chip[] {
  const chips: Chip[] = [];
  for (const n of q.niches)
    chips.push({ key: `n-${n}`, label: n, remove: (p) => ({ ...p, niches: p.niches.filter((x) => x !== n) }) });
  for (const l of q.locations)
    chips.push({ key: `l-${l.value}`, label: <><em>in</em> {l.label}</>, remove: (p) => ({ ...p, locations: p.locations.filter((x) => x.value !== l.value) }) });
  if (q.minFollowers != null || q.maxFollowers != null) {
    const text = q.minFollowers != null && q.maxFollowers != null ? `${compact(q.minFollowers)} to ${compact(q.maxFollowers)}`
      : q.minFollowers != null ? `over ${compact(q.minFollowers)}` : `under ${compact(q.maxFollowers!)}`;
    chips.push({ key: "f", label: <>{text} <em>followers</em></>, remove: (p) => ({ ...p, minFollowers: null, maxFollowers: null }) });
  }
  if (q.minEngagement != null)
    chips.push({ key: "e", label: <>{q.minEngagement}%+ <em>engagement</em></>, remove: (p) => ({ ...p, minEngagement: null }) });
  if (q.semantic)
    chips.push({ key: "s", topic: true, label: <><em>posts about</em> {q.semantic}</>, remove: (p) => ({ ...p, semantic: "" }) });
  return chips;
}

export default function Page() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("match");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(-1);
  const [copied, setCopied] = useState(false);

  const input = useRef<HTMLTextAreaElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const sheet = useRef<HTMLDivElement>(null);
  const latest = useRef(0);

  const run = useCallback(async (body: { query: string } | { filters: ParsedQuery }) => {
    const id = ++latest.current;
    try {
      const res = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      const json: SearchResponse = await res.json();
      if (id !== latest.current) return; // a newer search already answered
      setData(json); setError(null); setFocus(-1); setSort("match");
    } catch {
      if (id === latest.current) setError("Search didn't respond. Check that the dev server is running, then search again.");
    }
  }, []);

  useEffect(() => { run({ query: "" }); }, [run]);

  // Grow the headline-sized input with its content.
  useEffect(() => {
    const el = input.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [query]);

  const results: SearchResult[] = useMemo(() => {
    const list = [...(data?.results ?? [])];
    if (sort === "followers") list.sort((a, b) => b.creator.followers - a.creator.followers);
    if (sort === "engagement") list.sort((a, b) => b.creator.engagement - a.creator.engagement);
    if (sort === "rate") list.sort((a, b) => a.creator.rate - b.creator.rate);
    return list;
  }, [data, sort]);

  const toggle = useCallback((id: string) => {
    setPicked((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });
  }, []);

  // Keyboard: arrows move between cards, S shortlists, / returns to the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      if (e.key === "Escape" && typing) { (e.target as HTMLElement).blur(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); input.current?.focus(); input.current?.select(); return; }
      if (!results.length) return;

      const cols = sheet.current ? getComputedStyle(sheet.current).gridTemplateColumns.split(" ").length : 1;
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (step !== undefined) {
        e.preventDefault();
        const next = focus < 0 ? 0 : Math.max(0, Math.min(results.length - 1, focus + step));
        setFocus(next);
        cards.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (e.key.toLowerCase() === "s" && focus >= 0) {
        toggle(results[focus].creator.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results, focus, toggle]);

  // Remember every creator we've seen so the shortlist survives a new search.
  const [known, setKnown] = useState<Map<string, Creator>>(new Map());
  useEffect(() => {
    if (!data) return;
    setKnown((prev) => { const next = new Map(prev); for (const r of data.results) next.set(r.creator.id, r.creator); return next; });
  }, [data]);
  const shortlist = useMemo(
    () => [...picked].map((id) => known.get(id)).filter((c): c is Creator => !!c),
    [picked, known],
  );

  const copyShortlist = async () => {
    const lines = shortlist.map((c) => `${c.name} (${c.handle}), ${compact(c.followers)} followers, ${c.city}, $${c.rate.toLocaleString("en-US")} per reel`);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  const chips = data ? chipsFor(data.parsed) : [];
  const submit = (text: string) => { setQuery(text); run({ query: text }); };

  return (
    <main className="page">
      <header className="masthead">
        <strong>Casting</strong>
        <span className="label">Demo roster, fictional creators</span>
      </header>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); run({ query }); }}>
        <h1><label htmlFor="q">Who does the campaign need?</label></h1>
        <p>Describe them in a sentence. Niche, place, audience size and topic are picked out for you.</p>
        <div className="ask-box">
          <textarea
            id="q" ref={input} rows={1} value={query} autoFocus spellCheck={false}
            placeholder="Fitness creators in Florida under 100K who post about energy drinks"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run({ query }); } }}
          />
          <button className="go" type="submit">Search</button>
        </div>
        <div className="examples">
          {EXAMPLES.map((ex) => <button type="button" key={ex} onClick={() => submit(ex)}>{ex}</button>)}
        </div>
      </form>

      <div className="reading" aria-live="polite">
        {chips.length > 0 && <span className="label">Read as</span>}
        {chips.map((chip) => (
          <span key={chip.key} className="chip">
            {chip.label}
            <button aria-label="Remove this filter" onClick={() => data && run({ filters: chip.remove(data.parsed) })}>×</button>
          </span>
        ))}
      </div>

      <div className="toolbar">
        <div>
          {data && <span className="count">{results.length} {results.length === 1 ? "creator" : "creators"}</span>}
          {data && chips.length > 0 && (
            <span className="how">{PARSER_LABEL[data.parser]}, {RANKER_LABEL[data.ranker]}, {data.tookMs} ms</span>
          )}
        </div>
        <div className="sort" role="group" aria-label="Sort by">
          {SORTS.map(([key, label]) => (
            <button key={key} aria-pressed={sort === key} onClick={() => setSort(key)}>{label}</button>
          ))}
        </div>
      </div>

      {error && <div className="empty"><h2>No answer from search</h2><p>{error}</p></div>}

      {!error && data && results.length === 0 && (
        <div className="empty">
          <h2>Nobody fits all of that</h2>
          <p>Remove a filter above to widen the search. The follower range and the topic are usually the tightest.</p>
        </div>
      )}

      <div className="sheet" ref={sheet}>
        {results.map((r, i) => (
          <CreatorCard
            key={r.creator.id}
            ref={(el) => { cards.current[i] = el; }}
            creator={r.creator}
            reason={r.reason}
            picked={picked.has(r.creator.id)}
            focused={focus === i}
            onPick={() => toggle(r.creator.id)}
            onFocus={() => setFocus(i)}
          />
        ))}
      </div>

      <p className="keys">
        <span><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>S</kbd> shortlist</span>
        <span><kbd>/</kbd> new search</span>
        <span>Sweep across a photo to flip through the profile</span>
      </p>

      {shortlist.length > 0 && (
        <aside className="tray" aria-label="Shortlist">
          <strong>{shortlist.length} shortlisted</strong>
          <span>{compact(shortlist.reduce((s, c) => s + c.followers, 0))} combined reach</span>
          <span>${shortlist.reduce((s, c) => s + c.rate, 0).toLocaleString("en-US")} estimated</span>
          <span className="names">{shortlist.map((c) => c.name).join(", ")}</span>
          <button className="clear" onClick={() => setPicked(new Set())}>Clear</button>
          <button className="go" onClick={copyShortlist}>{copied ? "Copied" : "Copy shortlist"}</button>
        </aside>
      )}
    </main>
  );
}
