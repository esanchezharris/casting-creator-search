"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Copy } from "lucide-react";
import { toast } from "sonner";
import { CreatorCard, compact, initials, money } from "@/components/CreatorCard";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { FilterChips, summarize, type FilterEdit } from "@/components/FilterChips";
import { QuickLook } from "@/components/QuickLook";
import type { Creator, SearchResponse, SearchResult } from "@/lib/types";

const EXAMPLES = [
  "Fitness creators who post about energy drinks",
  "Fitness creators in Florida who post about energy drinks",
  "Skincare creators with a mostly US audience who post about sunscreen",
  "Who on the roster is open to paid usage",
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

  // Opening the panel narrows the grid, so bring the focused card back into view.
  useEffect(() => {
    if (looking && focus >= 0) cards.current[focus]?.scrollIntoView({ block: "nearest" });
  }, [looking, focus]);

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
      onOpen={() => { setFocus(i); setLooking(true); }}
    />
  );

  const grid = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,236px),1fr))] gap-x-2 gap-y-6";

  return (
    <main className={cn("mx-auto max-w-[1440px] px-4 pb-36 sm:px-8", open && "lg:mr-0 lg:pr-[472px]")}>
      <header className="flex h-16 items-center justify-between">
        <span className="flex items-center gap-2 text-[17px] font-medium tracking-[-0.02em]">
          <i className="size-2 rounded-full bg-destructive" aria-hidden="true" />Casting
        </span>
        <span className="text-[13px] text-muted-foreground">Demo data · every creator is fictional</span>
      </header>

      <form className="mx-auto mt-6 max-w-3xl sm:mt-14" onSubmit={(e) => { e.preventDefault(); submit(query); }}>
        <h1 className="text-center text-[30px] leading-[1.1] font-medium tracking-[-0.03em] text-balance sm:text-[40px]">
          <label htmlFor="q">Who does the brief need?</label>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-pretty text-muted-foreground">
          Describe them in a sentence. The roster is searched first; if it is thin, you also see who would be worth signing.
        </p>
        <div className="mt-7 flex items-end gap-2 rounded-2xl border bg-card p-2 pl-4 shadow-[0_1px_2px_rgb(23_23_21/0.04)] transition-[border-color] duration-150 focus-within:border-foreground">
          <textarea
            id="q" ref={input} rows={1} value={query} autoFocus spellCheck={false}
            placeholder="Fitness creators who post about energy drinks"
            className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-2 text-[17px] leading-snug outline-none placeholder:text-muted-foreground/70"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(query); } }}
          />
          <Button type="submit" size="icon" aria-label="Search" aria-busy={loading} className="press size-10 shrink-0 rounded-xl">
            <ArrowUp className="size-5" />
          </Button>
        </div>
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
          {EXAMPLES.map((ex) => (
            <button
              type="button" key={ex} onClick={() => { setQuery(ex); submit(ex); }}
              className="press shrink-0 rounded-full border px-3 py-1 text-left text-[13px] text-muted-foreground hover:border-foreground hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      <div className="sticky top-0 z-20 mt-10 border-b bg-background/85 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-h-8 items-baseline gap-3" aria-live="polite">
            {first && <span className="font-medium">Loading the roster</span>}
            {data && (
              <span className="font-medium">
                {data.offRoster.length > 0
                  ? `${main.length} on the roster, ${off.length} not yet`
                  : `${main.length} ${main.length === 1 ? "creator" : "creators"}`}
              </span>
            )}
            {data && loading && <span className="text-[13px] text-muted-foreground">Searching…</span>}
            {data && !loading && hasFilters && (
              <span className="hidden text-[13px] text-muted-foreground md:inline">
                {PARSER_LABEL[data.parser]}, {RANKER_LABEL[data.ranker]}, {data.tookMs} ms
              </span>
            )}
          </div>
          <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
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
        {data && <div className="mt-2.5"><FilterChips parsed={data.parsed} places={data.places} onChange={(filters) => run({ filters })} /></div>}
      </div>

      {error && (
        <div className="mt-14 max-w-md">
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">No answer from search</h2>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      )}

      {!error && !loading && data && all.length === 0 && (
        <div className="mt-14 max-w-md">
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">Nobody fits all of that</h2>
          <p className="mt-1 text-pretty text-muted-foreground">
            Not on the roster, and not among applicants or prospects. Remove a filter above to widen the search; the follower range and the topic are usually the tightest.
          </p>
        </div>
      )}

      {first && (
        <div className={cn(grid, "mt-4")} aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="p-2">
              <Skeleton className="aspect-[4/5] rounded-[17px]" />
              <Skeleton className="mt-4 h-4 w-3/5" /><Skeleton className="mt-2 h-3.5 w-4/5" /><Skeleton className="mt-4 h-8 w-full" />
            </div>
          ))}
        </div>
      )}

      <div className={cn("transition-opacity duration-150", loading && "pointer-events-none opacity-50")}>
        <div className={cn(grid, "mt-4")} ref={sheet}>{main.map((r, i) => card(r, i))}</div>

        {off.length > 0 && (
          <section className="mt-12 border-t pt-8" aria-label="Not on the roster yet">
            <h2 className="text-[22px] font-medium tracking-[-0.02em]">Not on the roster yet</h2>
            <p className="mt-1 max-w-2xl text-pretty text-muted-foreground">
              {main.length === 0 ? "Nobody on the roster fits this brief."
                : `Only ${main.length} on the roster ${main.length === 1 ? "fits" : "fit"} this brief.`}
              {" "}These applicants and prospects do. They have no agreed rate and would need signing first.
            </p>
            <div className={cn(grid, "mt-5")}>{off.map((r, i) => card(r, main.length + i))}</div>
          </section>
        )}
      </div>

      <footer className="mt-16 border-t pt-5 text-[13px] text-muted-foreground">
        <p className="hidden flex-wrap items-center gap-x-5 gap-y-2 sm:flex">
          <span className="flex items-center gap-1"><Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span className="flex items-center gap-1"><Kbd>Space</Kbd> quick look</span>
          <span className="flex items-center gap-1"><Kbd>S</Kbd> shortlist</span>
          <span className="flex items-center gap-1"><Kbd>,</Kbd><Kbd>.</Kbd> flip photos</span>
          <span className="flex items-center gap-1"><Kbd>/</Kbd> new search</span>
          <span>Sweep across a photo to flip through the profile</span>
        </p>
        <p className="mt-4 max-w-3xl text-pretty">
          Every creator, number and note here is fictional and made for this demo.
          {all.some((r) => r.creator.images.length > 0) && " The photos and clips are AI-generated stand-ins; nobody in them is a real person."}
          {all.some((r) => r.creator.images.length === 0) && " Frames with initials are placeholders for profiles with no photos yet."}
        </p>
      </footer>

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
          className={cn(
            "tray fixed bottom-4 left-1/2 z-40 flex w-[min(720px,calc(100%-24px))] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-card py-2 pr-2 pl-3 shadow-[0_10px_36px_rgb(23_23_21/0.14)]",
            open && "lg:left-[calc((100%-440px)/2)]",
          )}
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
    </main>
  );
}
