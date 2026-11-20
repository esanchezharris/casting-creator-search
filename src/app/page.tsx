"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { CreatorCard, compact, initials, money } from "@/components/CreatorCard";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { FilterChips, summarize, type FilterEdit } from "@/components/FilterChips";
import { FilterPanel, SORTS, type Sort } from "@/components/FilterPanel";
import { QuickLook } from "@/components/QuickLook";
import type { Creator, SearchResponse, SearchResult } from "@/lib/types";

/** Offered in the empty search box; Tab accepts it. */
const SUGGESTION = "Fitness creators who post about energy drinks";
const EXAMPLES = [
  "Fitness creators who post about energy drinks",
  "Fitness creators in Florida who post about energy drinks",
  "Skincare creators with a mostly US audience who post about sunscreen",
  "Who on the roster is open to paid usage",
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
  const [shortlist, setShortlist] = useState<Shortlist>({ brief: "", creators: [] });
  const [restored, setRestored] = useState(false);

  const input = useRef<HTMLInputElement>(null);
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
        if (t instanceof HTMLButtonElement && !t.closest("[data-card]")) return;
        e.preventDefault();
        if (focus < 0) { setFocus(0); setLooking(true); } else setLooking((v) => !v);
      } else if (e.key.toLowerCase() === "s" && focus >= 0) {
        toggle(all[focus].creator);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [all, focus, toggle]);

  // Quick look covers the page, so the page behind it should not scroll.
  useEffect(() => {
    if (!looking) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [looking]);

  const copyShortlist = async () => {
    try {
      await navigator.clipboard.writeText(shortlistText(shortlist));
      toast.success("Shortlist copied", { description: "Paste it into an email to the brand." });
    } catch {
      toast.error("Could not copy", { description: "The browser blocked the clipboard." });
    }
  };

  // Searching hands the keyboard to the grid, so arrows and S work without a click.
  const submit = (text: string) => { input.current?.blur(); run({ query: text }); };

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
      onLeave={() => { if (!looking) setFocus((f) => (f === i ? -1 : f)); }}
      onOpen={() => { setFocus(i); setLooking(true); }}
    />
  );

  const grid = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,224px),1fr))] gap-x-1.5 gap-y-5";

  return (
    <div className="lg:flex">
      <aside className="hidden w-[272px] shrink-0 border-r bg-secondary lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-5">
            <span className="text-[16px] font-medium tracking-[-0.02em]">Casting</span>
            <span className="text-[13px] text-muted-foreground">Demo data</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
            {data && (
              <FilterPanel
                parsed={data.parsed} places={data.places} sort={sort} onSort={setSort}
                onChange={(filters) => run({ filters })}
                onReset={() => { setQuery(""); run({ query: "" }); }}
              />
            )}
            <section className="border-t pt-4">
              <h2 className="mb-1.5 text-[13px] font-medium">Example briefs</h2>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex} onClick={() => { setQuery(ex); submit(ex); }}
                  className="press block w-full rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </section>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-32 sm:px-6">
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
          <form className="flex h-14 items-center gap-3" onSubmit={(e) => { e.preventDefault(); submit(query); }}>
            <span className="text-[16px] font-medium tracking-[-0.02em] lg:hidden">Casting</span>
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card pr-1 pl-3 transition-[border-color] duration-150 focus-within:border-foreground">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                id="q" ref={input} value={query} autoFocus spellCheck={false} autoComplete="off"
                aria-label="Describe the brief" placeholder={SUGGESTION}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Tab in the empty box accepts the suggestion instead of leaving the field.
                  if (e.key === "Tab" && !e.shiftKey && !query) { e.preventDefault(); setQuery(SUGGESTION); }
                }}
              />
              {!query && <span className="hidden shrink-0 items-center gap-1.5 text-[13px] text-muted-foreground sm:flex"><Kbd>Tab</Kbd> to fill</span>}
              <Button type="submit" size="sm" aria-busy={loading} className="press h-7 shrink-0 rounded-md px-2.5 text-[13px]">Search</Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-2.5">
            <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5" aria-live="polite">
              {first && <span className="font-medium">Loading the roster</span>}
              {data && (
                <span className="font-medium whitespace-nowrap">
                  {data.offRoster.length > 0
                    ? `${main.length} on the roster, ${off.length} not yet`
                    : `${main.length} ${main.length === 1 ? "creator" : "creators"}`}
                </span>
              )}
              {data && <FilterChips parsed={data.parsed} places={data.places} onChange={(filters) => run({ filters })} addClassName="lg:hidden" />}
            </div>
            <div className="flex items-center gap-3">
              {data && loading && <span className="text-[13px] text-muted-foreground">Searching…</span>}
              {data && !loading && hasFilters && (
                <span className="hidden text-[13px] whitespace-nowrap text-muted-foreground xl:inline">
                  {PARSER_LABEL[data.parser]}, {RANKER_LABEL[data.ranker]}, {data.tookMs} ms
                </span>
              )}
              <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none] lg:hidden">
                <ToggleGroup
                  aria-label="Sort by" value={[sort]} spacing={1}
                  onValueChange={(v) => { if (v[0]) setSort(v[0] as Sort); }}
                  className="rounded-full border bg-card p-0.5"
                >
                  {SORTS.map(([key, label]) => (
                    <ToggleGroupItem
                      key={key} value={key}
                      className="h-7 rounded-full px-3 text-[13px] font-normal text-muted-foreground hover:bg-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    >
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-12 max-w-md">
            <h2 className="text-[20px] font-medium tracking-[-0.02em]">No answer from search</h2>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </div>
        )}

        {!error && !loading && data && all.length === 0 && (
          <div className="mt-12 max-w-md">
            <h2 className="text-[20px] font-medium tracking-[-0.02em]">Nobody fits all of that</h2>
            <p className="mt-1 text-pretty text-muted-foreground">
              Not on the roster, and not among applicants or prospects. Remove a filter to widen the search; the follower range and the topic are usually the tightest.
            </p>
          </div>
        )}

        {first && (
          <div className={cn(grid, "mt-3")} aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="p-2">
                <Skeleton className="aspect-[4/5] rounded-[17px]" />
                <Skeleton className="mt-4 h-4 w-3/5" /><Skeleton className="mt-2 h-3.5 w-4/5" /><Skeleton className="mt-4 h-8 w-full" />
              </div>
            ))}
          </div>
        )}

        <div className={cn("transition-opacity duration-150", loading && "pointer-events-none opacity-50")}>
          <div className={cn(grid, "mt-3")} ref={sheet}>{main.map((r, i) => card(r, i))}</div>

          {off.length > 0 && (
            <section className="mt-10 border-t pt-6" aria-label="Not on the roster yet">
              <h2 className="text-[18px] font-medium tracking-[-0.02em]">Not on the roster yet</h2>
              <p className="mt-1 max-w-2xl text-pretty text-muted-foreground">
                {main.length === 0 ? "Nobody on the roster fits this brief."
                  : `Only ${main.length} on the roster ${main.length === 1 ? "fits" : "fit"} this brief.`}
                {" "}These applicants and prospects do. They have no agreed rate and would need signing first.
              </p>
              <div className={cn(grid, "mt-4")}>{off.map((r, i) => card(r, main.length + i))}</div>
            </section>
          )}
        </div>

        <footer className="mt-14 border-t pt-5 text-[13px] text-muted-foreground">
          <p className="hidden flex-wrap items-center gap-x-5 gap-y-2 sm:flex">
            <span className="flex items-center gap-1"><Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span className="flex items-center gap-1"><Kbd>Space</Kbd> quick look</span>
            <span className="flex items-center gap-1"><Kbd>S</Kbd> shortlist</span>
            <span className="flex items-center gap-1"><Kbd>,</Kbd><Kbd>.</Kbd> flip photos</span>
            <span className="flex items-center gap-1"><Kbd>/</Kbd> search</span>
            <span>Sweep across a photo to flip through the profile</span>
          </p>
          <p className="mt-4 max-w-3xl text-pretty">
            Every creator, number, post and comment here is fictional and made for this demo.
            {all.some((r) => r.creator.images.length > 0) && " The photos and clips are AI-generated stand-ins; nobody in them is a real person."}
            {all.some((r) => r.creator.images.length === 0) && " Frames with initials are placeholders for profiles with no photos yet."}
          </p>
        </footer>
      </main>

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
        <aside
          aria-label="Shortlist"
          className="tray fixed bottom-4 left-1/2 z-40 flex w-[min(680px,calc(100%-24px))] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-card py-2 pr-2 pl-3 shadow-[0_10px_36px_rgb(23_23_21/0.14)] lg:left-[calc(50%+136px)]"
        >
          <div className="flex shrink-0 -space-x-2 max-sm:hidden">
            {shortlist.creators.slice(0, 4).map((c) => (
              <span key={c.id} className="grid size-8 place-items-center overflow-hidden rounded-full bg-muted text-[13px] ring-2 ring-card">
                {c.images[0] ? <img src={c.images[0]} alt="" className="size-full object-cover" /> : initials(c.name)}
              </span>
            ))}
          </div>
          <p className="min-w-0 flex-1 truncate">
            <span className="font-medium">{shortlist.creators.length} shortlisted</span>
            <span className="hidden text-muted-foreground sm:inline">
              {" · "}{compact(shortlist.creators.reduce((s, c) => s + c.recentReach, 0))} reach
              {" · "}{money(signed.reduce((s, c) => s + (c.rate ?? 0), 0))}
              {unsigned > 0 && ` · ${unsigned} to sign`}
            </span>
          </p>
          <Button variant="ghost" className="press h-9 text-muted-foreground max-sm:px-2" onClick={() => setShortlist({ brief: "", creators: [] })}>Clear</Button>
          <Button className="press h-9 gap-2 rounded-xl px-3.5" onClick={copyShortlist}><Copy /> Copy shortlist</Button>
        </aside>
      )}
    </div>
  );
}
