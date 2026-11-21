"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Keyboard, PanelLeftClose, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { CreatorCard, compact, initials, money } from "@/components/CreatorCard";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FilterChips, summarize, type FilterEdit } from "@/components/FilterChips";
import { activeCount, FilterPanel, SORTS, type Sort } from "@/components/FilterPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlanPanel } from "@/components/PlanPanel";
import { QuickLook } from "@/components/QuickLook";
import { Segmented } from "@/components/Segmented";
import { useElastic } from "@/lib/elastic";
import type { Creator, PlanPick, SearchResponse, SearchResult } from "@/lib/types";

const NO_FILTERS = { niches: [], locations: [], stages: [], genders: [], minAge: null, maxAge: null, minFollowers: null, maxFollowers: null, maxRate: null, minEngagement: null, minAudienceUS: null, semantic: "", brief: null };
const PANEL = "casting.filters.v1";
const KEYS: [string[], string][] = [
  [["←", "→", "↑", "↓"], "Move between creators"], [["Space"], "Open or close quick look"], [["S"], "Shortlist the focused creator"],
  [[",", "."], "Flip through photos"], [["/"], "Jump to the search box"], [["Esc"], "Close"],
];

const PARSER_LABEL = { llm: "Read by the language model", rules: "Read by the rule parser", chips: "Filters edited by hand" };
const RANKER_LABEL = { embeddings: "ranked by meaning", keywords: "ranked by keywords", hybrid: "ranked by keywords and meaning", reach: "ordered by recent reach" };

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
  // A creator opened from the proposed shortlist who is not among the cards below.
  const [peek, setPeek] = useState<SearchResult | null>(null);
  const [typing, setTyping] = useState(false);
  const [shortlist, setShortlist] = useState<Shortlist>({ brief: "", creators: [] });
  const [restored, setRestored] = useState(false);
  // The filter panel starts open on a wide screen and closed on a narrow one, then remembers.
  const [panel, setPanel] = useState(true);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(PANEL); } catch { /* use the default */ }
    setPanel(saved != null ? saved === "open" : window.matchMedia("(min-width: 1024px)").matches);
  }, []);
  // The panel slides only when someone presses the button, not when the saved state is restored.
  const [slide, setSlide] = useState(false);
  const togglePanel = () => {
    setSlide(true);
    setPanel((open) => {
      try { localStorage.setItem(PANEL, open ? "closed" : "open"); } catch { /* not remembered */ }
      return !open;
    });
  };
  const filterList = useElastic<HTMLDivElement>();
  const pageBody = useElastic<HTMLDivElement>("y", true);

  const input = useRef<HTMLTextAreaElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const sheet = useRef<HTMLDivElement>(null);
  // The frame each card is showing, so quick look opens on the post being looked at.
  const frames = useRef(new Map<string, number>());
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
      setData(json); setError(null); setFocus(-1); setLooking(false); setPeek(null); setSort("match"); setLoading(false);
      // A new answer starts at its first row, wherever the last one was scrolled to.
      window.scrollTo({ top: 0 });
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
        else { setLooking(false); setPeek(null); }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); input.current?.focus(); input.current?.select(); return; }
      // While a search is running the cards on screen are the old answer: keys must not act on them.
      if (!all.length || loading || peek) return;

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
  }, [all, focus, toggle, loading, peek]);

  // Quick look covers the page, so the page behind it should not scroll.
  const lookOpen = (looking && focus >= 0) || !!peek;
  useEffect(() => {
    if (!lookOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [lookOpen]);

  const copyShortlist = async () => {
    try {
      await navigator.clipboard.writeText(shortlistText(shortlist));
      toast.success("Shortlist copied", { description: "Paste it into an email to the brand." });
    } catch {
      toast.error("Could not copy", { description: "The browser blocked the clipboard." });
    }
  };

  const copyReply = async () => {
    if (!data?.plan) return;
    try {
      await navigator.clipboard.writeText(data.plan.reply);
      toast.success("Reply copied", { description: "Names, rates, the total and what was left out." });
    } catch {
      toast.error("Could not copy", { description: "The browser blocked the clipboard." });
    }
  };
  const addPlan = () => {
    if (!data?.plan) return;
    const add = data.plan.picks.map((p) => p.creator);
    setShortlist((prev) => ({ brief: asked.current, creators: [...prev.creators, ...add.filter((c) => !prev.creators.some((x) => x.id === c.id))] }));
  };
  // A pick that is also a card opens there, so the arrow keys carry on from it.
  const openPick = (p: PlanPick) => {
    const i = all.findIndex((r) => r.creator.id === p.creator.id);
    if (i >= 0) { setFocus(i); setLooking(true); } else setPeek(p);
  };

  // The brief box is one line until it is being typed in; a pasted brief gets room while it has the cursor.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "20px";
    if (typing) el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [query, typing]);

  // Searching hands the keyboard to the grid, so arrows and S work without a click.
  const submit = (text: string) => { input.current?.blur(); run({ query: text }); };

  const signed = shortlist.creators.filter((c) => c.rate != null);
  const unsigned = shortlist.creators.length - signed.length;
  const hasFilters = !!data && summarize(data.parsed) !== "";
  const open = peek ?? (looking && focus >= 0 ? all[focus] : null);
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
      onFrame={(index) => { frames.current.set(r.creator.id, index); }}
    />
  );

  const grid = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-1 gap-y-4";
  const parsed = data?.parsed ?? NO_FILTERS;
  const active = activeCount(parsed);

  return (
    <div className="lg:flex">
      {panel && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={togglePanel} aria-hidden="true" />}
      {/* On a wide screen the panel's width closes to nothing and its contents, pinned to the right edge, slide out with it. */}
      <aside
        aria-label="Filters" inert={!panel}
        className={cn(
          "shrink-0 bg-secondary max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-[280px] max-lg:border-r lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden",
          slide && "lg:transition-[width] lg:duration-200 lg:ease-(--ease-out) motion-reduce:transition-none",
          panel ? "lg:w-[264px]" : "max-lg:hidden lg:w-0",
        )}
      >
          <div className="flex h-full flex-col lg:absolute lg:inset-y-0 lg:right-0 lg:w-[264px] lg:border-r">
            <div className="flex h-12 shrink-0 items-center justify-between border-b pr-2 pl-4">
              <h2 className="text-[14px] font-medium">
                Filters{active > 0 && <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{active}</span>}
              </h2>
              <div className="flex items-center">
                {active > 0 && (
                  <Button variant="ghost" size="sm" className="press h-7 px-2 text-[13px] text-muted-foreground" onClick={() => { setQuery(""); run({ query: "" }); }}>
                    Clear all
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="press size-8 text-muted-foreground" aria-label="Hide filters" onClick={togglePanel}>
                  <PanelLeftClose />
                </Button>
              </div>
            </div>
            {/* Reaching the end of this list gives a little and settles; it never starts scrolling the results. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div ref={filterList}>
                <FilterPanel parsed={parsed} places={data?.places ?? []} facets={data?.facets ?? {}} onChange={(filters) => run({ filters })} />
              </div>
            </div>
          </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 sm:px-5">
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/90 px-4 backdrop-blur-md sm:-mx-5 sm:px-5">
          <form className="flex min-h-12 items-start gap-2 py-2" onSubmit={(e) => { e.preventDefault(); submit(query); }}>
            <span className="mr-1 flex h-8 items-center text-[15px] font-medium tracking-[-0.01em]">Casting</span>
            {!panel && (
              <Button type="button" variant="outline" size="sm" className="press h-8 gap-1.5 bg-card px-2.5 text-[13px]" onClick={togglePanel}>
                <SlidersHorizontal className="size-3.5" />Filters{active > 0 && <span className="text-muted-foreground tabular-nums">{active}</span>}
              </Button>
            )}
            <div className="flex min-h-8 min-w-0 flex-1 items-start gap-2 rounded-lg border bg-card py-[5px] pr-1 pl-2.5 transition-[border-color] duration-150 focus-within:border-foreground">
              <Search className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <textarea
                id="q" ref={input} value={query} autoFocus spellCheck={false} autoComplete="off" rows={1}
                aria-label="Describe the brief, or paste it" placeholder="Describe who the brief needs, or paste the brand's whole brief"
                className={cn("h-5 min-w-0 flex-1 resize-none bg-transparent text-[14px] leading-5 outline-none placeholder:text-muted-foreground/70", !typing && "overflow-hidden whitespace-nowrap")}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setTyping(true)} onBlur={() => setTyping(false)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(query); } }}
              />
              <Button type="submit" size="sm" aria-busy={loading} className="press -my-px h-6 shrink-0 rounded-md px-2 text-[13px]">Search</Button>
            </div>
            <Popover>
              <PopoverTrigger render={<Button type="button" variant="ghost" size="icon" className="press size-8 text-muted-foreground max-sm:hidden" aria-label="Keyboard shortcuts" />}>
                <Keyboard />
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-72 gap-0 p-3 text-[13px]">
                <p className="mb-2 font-medium">Keyboard</p>
                <ul className="grid gap-1.5">
                  {KEYS.map(([keys, what]) => (
                    <li key={what} className="flex items-center justify-between gap-3 text-muted-foreground">
                      {what}<span className="flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 border-t pt-2.5 text-muted-foreground">Sweep the mouse across a photo to flip through a profile.</p>
              </PopoverContent>
            </Popover>
          </form>
        </div>

        <div ref={pageBody}><div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3 pb-1">
          <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5" aria-live="polite">
            <h1 className="text-[15px] font-medium whitespace-nowrap">
              {first && "Loading creators"}
              {data && (data.offRoster.length > 0
                ? `${main.length} on the roster, ${off.length} not yet`
                : `${main.length} ${main.length === 1 ? "creator" : "creators"}`)}
            </h1>
            {data && hasFilters && <FilterChips parsed={data.parsed} places={data.places} onChange={(filters) => run({ filters })} addClassName="hidden" />}
            {data && loading && <span className="text-[13px] text-muted-foreground">Searching…</span>}
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {data && !loading && hasFilters && (
              <span className="hidden text-[13px] whitespace-nowrap text-muted-foreground 2xl:inline">
                {PARSER_LABEL[data.parser]}, {RANKER_LABEL[data.ranker]}, {data.tookMs} ms
              </span>
            )}
            <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
              <Segmented label="Sort by" value={sort} options={SORTS} onChange={setSort} />
            </div>
          </div>
        </div>

        {!error && data?.plan && data.parsed.brief && (
          <div className={cn("transition-opacity duration-150", loading && "pointer-events-none opacity-50")}>
            <PlanPanel ask={data.parsed.brief} plan={data.plan} picked={picked} onAdd={addPlan} onCopy={copyReply} onOpen={openPick} />
            {all.length > 0 && <h2 className="mt-5 text-[15px] font-medium">Everyone who fits exactly</h2>}
          </div>
        )}

        {error && (
          <div className="mt-12 max-w-md">
            <h2 className="text-[17px] font-medium">No answer from search</h2>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </div>
        )}

        {!error && !loading && data && all.length === 0 && !data.plan?.picks.length && (
          <div className="mt-12 max-w-md">
            <h2 className="text-[17px] font-medium">Nobody fits all of that</h2>
            <p className="mt-1 text-pretty text-muted-foreground">
              Not on the roster, and not among applicants or prospects. Remove a filter to widen the search; the follower range and the topic are usually the tightest.
            </p>
          </div>
        )}

        {first && (
          <div className={cn(grid, "mt-2")} aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="p-2">
                <Skeleton className="aspect-[4/5] rounded-xl" />
                <Skeleton className="mt-4 h-4 w-3/5" /><Skeleton className="mt-2 h-3.5 w-4/5" /><Skeleton className="mt-4 h-8 w-full" />
              </div>
            ))}
          </div>
        )}

        <div className={cn("-mx-2 transition-opacity duration-150", loading && "pointer-events-none opacity-50")}>
          <div className={cn(grid, "mt-2")} ref={sheet}>{main.map((r, i) => card(r, i))}</div>

          {off.length > 0 && (
            <section className="mx-2 mt-8 border-t pt-5" aria-label="Not on the roster yet">
              <h2 className="text-[15px] font-medium">Not on the roster yet</h2>
              <p className="mt-0.5 max-w-2xl text-[14px] text-pretty text-muted-foreground">
                {main.length === 0 ? "Nobody on the roster fits this brief."
                  : `Only ${main.length} on the roster ${main.length === 1 ? "fits" : "fit"} this brief.`}
                {" "}These applicants and prospects do. They have no agreed rate and would need signing first.
              </p>
              <div className={cn(grid, "-mx-2 mt-3")}>{off.map((r, i) => card(r, main.length + i))}</div>
            </section>
          )}
        </div>

        <footer className="mt-12 border-t pt-4 text-[13px] text-muted-foreground">
          <p className="max-w-3xl text-pretty">
            Demo data. Every creator, number, post and comment here is fictional.
            {all.some((r) => r.creator.images.length > 0) && " The photos and clips are AI-generated; nobody in them is a real person."}
          </p>
        </footer>
        </div></div>
      </main>

      {open && (
        <QuickLook
          key={open.creator.id}
          result={open}
          position={peek ? "Proposed shortlist" : `${focus + 1} of ${all.length}`}
          picked={picked.has(open.creator.id)}
          onPick={() => toggle(open.creator)}
          onClose={() => { setLooking(false); setPeek(null); }}
          start={frames.current.get(open.creator.id) ?? 0}
        />
      )}

      {shortlist.creators.length > 0 && (
        <aside
          aria-label="Shortlist"
          className={cn(
            "tray fixed bottom-4 left-1/2 z-40 flex w-[min(640px,calc(100%-24px))] -translate-x-1/2 items-center gap-3 rounded-xl border bg-card py-1.5 pr-1.5 pl-3 shadow-[0_8px_30px_rgb(23_23_21/0.14)]",
            panel && "lg:left-[calc(50%+132px)]",
          )}
        >
          <div className="flex shrink-0 -space-x-2 max-sm:hidden">
            {shortlist.creators.slice(0, 4).map((c) => (
              <span key={c.id} className="grid size-7 place-items-center overflow-hidden rounded-full bg-muted text-[12px] ring-2 ring-card">
                {c.images[0] ? <img src={c.images[0]} alt="" className="size-full object-cover" /> : initials(c.name)}
              </span>
            ))}
          </div>
          <p className="min-w-0 flex-1 truncate text-[14px]">
            <span className="font-medium">{shortlist.creators.length} shortlisted</span>
            <span className="hidden text-muted-foreground sm:inline">
              {" · "}{compact(shortlist.creators.reduce((s, c) => s + c.recentReach, 0))} reach
              {" · "}{money(signed.reduce((s, c) => s + (c.rate ?? 0), 0))}
              {unsigned > 0 && ` · ${unsigned} to sign`}
            </span>
          </p>
          <Button variant="ghost" size="sm" className="press h-8 text-[13px] text-muted-foreground" onClick={() => setShortlist({ brief: "", creators: [] })}>Clear</Button>
          <Button size="sm" className="press h-8 gap-1.5 rounded-lg px-3 text-[13px]" onClick={copyShortlist}><Copy className="size-3.5" /> Copy shortlist</Button>
        </aside>
      )}
    </div>
  );
}
