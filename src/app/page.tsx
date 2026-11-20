"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreatorCard, compact, money } from "@/components/CreatorCard";
import { FilterChips, summarize, type FilterEdit } from "@/components/FilterChips";
import { QuickLook } from "@/components/QuickLook";
import type { Creator, SearchResponse, SearchResult } from "@/lib/types";

const EXAMPLES = [
  "Fitness creators in Florida under 100K who post about energy drinks",
  "Beauty creators with a mostly US audience and engagement over 5%",
  "Signed creators in Texas who post about sunscreen",
  "Runners who review shoes",
];

type Sort = "match" | "reach" | "followers" | "engagement" | "rate";
const SORTS: [Sort, string][] = [
  ["match", "Best match"], ["reach", "Recent reach"], ["followers", "Followers"],
  ["engagement", "Engagement"], ["rate", "Lowest rate"],
];

const PARSER_LABEL = { llm: "Read by the language model", rules: "Read by the rule parser", chips: "Filters edited by hand" };
const RANKER_LABEL = { embeddings: "ranked by meaning", keywords: "ranked by keywords", reach: "ordered by recent reach" };

const STORE = "casting.shortlist.v1";
type Shortlist = { brief: string; creators: Creator[] };

function sorted(list: SearchResult[], sort: Sort): SearchResult[] {
  const out = [...list];
  if (sort === "reach") out.sort((a, b) => b.creator.recentReach - a.creator.recentReach);
  if (sort === "followers") out.sort((a, b) => b.creator.followers - a.creator.followers);
  if (sort === "engagement") out.sort((a, b) => b.creator.engagement - a.creator.engagement);
  // Creators with no agreed rate go last.
  if (sort === "rate") out.sort((a, b) => (a.creator.rate ?? Infinity) - (b.creator.rate ?? Infinity));
  return out;
}

/** Text a talent partner could paste to a brand: brief, one line per creator, a total. */
function shortlistText({ brief, creators }: Shortlist): string {
  const line = (c: Creator) =>
    `- ${c.name} (${c.handle}): ${compact(c.recentReach)} recent reach, ${c.audience.us}% US audience, ` +
    (c.rate != null ? `${money(c.rate)} per reel` : `no rate yet (${c.stage})`);
  const roster = creators.filter((c) => c.stage === "roster");
  const rest = creators.filter((c) => c.stage !== "roster");
  const out = [`Brief: ${brief || "no brief typed (browsing the roster)"}`];
  if (roster.length) {
    out.push("", "On the roster", ...roster.map(line));
    const reach = roster.reduce((s, c) => s + c.recentReach, 0);
    const cost = roster.reduce((s, c) => s + (c.rate ?? 0), 0);
    out.push(`Total: ${roster.length} ${roster.length === 1 ? "creator" : "creators"}, ${compact(reach)} combined recent reach, ${money(cost)}`);
  }
  if (rest.length) out.push("", "Would need signing (no agreed rate yet)", ...rest.map(line));
  return out.join("\n");
}

export default function Page() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("match");
  const [focus, setFocus] = useState(-1);
  const [looking, setLooking] = useState(false);
  const [copied, setCopied] = useState<"" | "Copied" | "Copy failed">("");
  const [shortlist, setShortlist] = useState<Shortlist>({ brief: "", creators: [] });
  const [restored, setRestored] = useState(false);

  const input = useRef<HTMLTextAreaElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const sheet = useRef<HTMLDivElement>(null);
  const latest = useRef(0);
  // The words behind the results on screen, kept for the shortlist's first line.
  const asked = useRef("");

  const run = useCallback(async (body: { query: string } | { filters: FilterEdit }) => {
    const id = ++latest.current;
    setLoading(true);
    try {
      const res = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      const json: SearchResponse = await res.json();
      if (id !== latest.current) return; // a newer search already answered
      asked.current = "query" in body ? body.query.trim() : summarize(json.parsed);
      setData(json); setError(null); setFocus(-1); setSort("match"); setLoading(false);
    } catch {
      if (id !== latest.current) return;
      setError("Search didn't respond. Check that the dev server is running, then search again.");
      setLoading(false);
    }
  }, []);

  useEffect(() => { run({ query: "" }); }, [run]);

  // Grow the headline-sized input with its content.
  useEffect(() => {
    const fit = () => {
      const el = input.current;
      if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [query]);

  // The shortlist survives a reload. Storage can be blocked or full, so every touch is guarded.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
      if (saved && Array.isArray(saved.creators)) setShortlist({ brief: String(saved.brief ?? ""), creators: saved.creators });
    } catch { /* start empty */ }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORE, JSON.stringify(shortlist)); } catch { /* keep it in memory only */ }
  }, [shortlist, restored]);

  const main = useMemo(() => sorted(data?.results ?? [], sort), [data, sort]);
  const off = useMemo(() => sorted(data?.offRoster ?? [], sort), [data, sort]);
  const all = useMemo(() => [...main, ...off], [main, off]);
  const picked = useMemo(() => new Set(shortlist.creators.map((c) => c.id)), [shortlist]);

  const toggle = useCallback((c: Creator) => {
    setShortlist((prev) => prev.creators.some((x) => x.id === c.id)
      ? { ...prev, creators: prev.creators.filter((x) => x.id !== c.id) }
      // The first line of the copied text is the brief the latest pick came from.
      : { brief: asked.current, creators: [...prev.creators, c] });
  }, []);

  // Keyboard: arrows move, S shortlists, Space opens quick look, / returns to the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing = t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement;
      if (e.key === "Escape") {
        if (typing) (t as HTMLElement).blur();
        else setLooking(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); input.current?.focus(); input.current?.select(); return; }
      if (!all.length) return;

      const cols = sheet.current ? getComputedStyle(sheet.current).gridTemplateColumns.split(" ").length : 1;
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (step !== undefined) {
        e.preventDefault();
        const next = focus < 0 ? 0 : Math.max(0, Math.min(all.length - 1, focus + step));
        setFocus(next);
        cards.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (e.key === " ") {
        // On a button outside the grid, Space should press that button as usual.
        if (t instanceof HTMLButtonElement && !t.closest(".card")) return;
        e.preventDefault();
        if (focus < 0) { setFocus(0); setLooking(true); } else setLooking((v) => !v);
      } else if (e.key.toLowerCase() === "s" && focus >= 0) {
        toggle(all[focus].creator);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [all, focus, toggle]);

  const copyShortlist = async () => {
    try {
      await navigator.clipboard.writeText(shortlistText(shortlist));
      setCopied("Copied");
    } catch {
      setCopied("Copy failed");
    }
    setTimeout(() => setCopied(""), 1600);
  };

  const signed = shortlist.creators.filter((c) => c.rate != null);
  const unsigned = shortlist.creators.length - signed.length;
  const hasFilters = !!data && summarize(data.parsed) !== "";
  const open = looking && focus >= 0 ? all[focus] : null;
  const first = !data && loading;

  const card = (r: SearchResult, i: number) => (
    <CreatorCard
      key={r.creator.id}
      ref={(el) => { cards.current[i] = el; }}
      result={r}
      picked={picked.has(r.creator.id)}
      focused={focus === i}
      onPick={() => toggle(r.creator)}
      onFocus={() => setFocus(i)}
      onOpen={() => { setFocus(i); setLooking(true); }}
    />
  );

  return (
    <main className={`page${open ? " looking" : ""}`}>
      <header className="masthead">
        <strong>Casting</strong>
        <span className="label">Demo data · fictional creators</span>
      </header>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); run({ query }); }}>
        <h1><label htmlFor="q">Who does the brief need?</label></h1>
        <p>Describe them in a sentence. The roster is searched first; if it is thin, you also see who would be worth signing.</p>
        <div className="ask-box">
          <textarea
            id="q" ref={input} rows={1} value={query} autoFocus spellCheck={false}
            placeholder="Fitness creators in Florida under 100K who post about energy drinks"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run({ query }); } }}
          />
          <button className="go" type="submit" aria-busy={loading}>Search</button>
        </div>
        <div className="examples">
          {EXAMPLES.map((ex) => <button type="button" key={ex} onClick={() => { setQuery(ex); run({ query: ex }); }}>{ex}</button>)}
        </div>
      </form>

      {data
        ? <FilterChips parsed={data.parsed} places={data.places} onChange={(filters) => run({ filters })} />
        : <div className="reading" />}

      <div className="toolbar">
        <div className="status" aria-live="polite">
          {first && <span className="count">Loading the roster</span>}
          {data && (
            <span className="count">
              {data.offRoster.length > 0
                ? `${main.length} on the roster, ${off.length} not yet`
                : `${main.length} ${main.length === 1 ? "creator" : "creators"}`}
            </span>
          )}
          {data && loading && <span className="label busy">Searching</span>}
          {data && !loading && hasFilters && (
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

      {!error && !loading && data && all.length === 0 && (
        <div className="empty">
          <h2>Nobody fits all of that</h2>
          <p>Not on the roster, and not among applicants or prospects. Remove a filter above to widen the search; the follower range and the topic are usually the tightest.</p>
        </div>
      )}

      {first && (
        <div className="sheet" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="card skeleton"><div className="frame" /><i /><i /><i /></div>
          ))}
        </div>
      )}

      <div className={loading ? "results stale" : "results"}>
        <div className="sheet" ref={sheet}>{main.map((r, i) => card(r, i))}</div>

        {off.length > 0 && (
          <section className="group" aria-label="Not on the roster yet">
            <h2>Not on the roster yet</h2>
            <p>
              {main.length === 0 ? "Nobody on the roster fits this brief."
                : `Only ${main.length} on the roster ${main.length === 1 ? "fits" : "fit"} this brief.`}
              {" "}These applicants and prospects do. They have no agreed rate and would need signing first.
            </p>
            <div className="sheet">{off.map((r, i) => card(r, main.length + i))}</div>
          </section>
        )}
      </div>

      <p className="keys">
        <span><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>Space</kbd> quick look</span>
        <span><kbd>S</kbd> shortlist</span>
        <span><kbd>,</kbd><kbd>.</kbd> flip photos</span>
        <span><kbd>/</kbd> new search</span>
        <span>Sweep or drag across a photo to flip through the profile</span>
      </p>
      <p className="fine">
        Every creator, number and note on this page is fictional and generated for the demo.
        {all.some((r) => r.creator.images.length === 0) && " Photo frames are placeholders."}
      </p>

      {open && (
        <QuickLook
          key={open.creator.id}
          result={open}
          position={`${focus + 1} of ${all.length}`}
          picked={picked.has(open.creator.id)}
          onPick={() => toggle(open.creator)}
          onClose={() => setLooking(false)}
        />
      )}

      {shortlist.creators.length > 0 && (
        <aside className="tray" aria-label="Shortlist">
          <strong>{shortlist.creators.length} shortlisted</strong>
          <span className="extra">{compact(shortlist.creators.reduce((s, c) => s + c.recentReach, 0))} combined reach</span>
          <span className="extra">
            {money(signed.reduce((s, c) => s + (c.rate ?? 0), 0))}
            {unsigned > 0 && `, ${unsigned} to sign`}
          </span>
          <span className="names">{shortlist.creators.map((c) => c.name).join(", ")}</span>
          <button className="clear" onClick={() => setShortlist({ brief: "", creators: [] })}>Clear</button>
          <button className="go" onClick={copyShortlist}>{copied || "Copy shortlist"}</button>
        </aside>
      )}
    </main>
  );
}
