import fs from "node:fs";
import path from "node:path";
import creatorsJson from "../../data/creators.json";
import { closest } from "./fuzzy";
import { Creator, ParsedQuery, SearchResult } from "./types";

export const creators = creatorsJson as Creator[];

// ------------------------------------------------------------------ filters

/** Every hard filter except stage, which search() handles so it can put the roster first. */
export function applyFilters(q: ParsedQuery): Creator[] {
  return creators.filter((c) => {
    if (q.niches.length && !q.niches.some((n) => c.niches.includes(n))) return false;
    if (q.locations.length && !q.locations.some((l) => c[l.field] === l.value)) return false;
    if (q.minFollowers != null && c.followers < q.minFollowers) return false;
    if (q.maxFollowers != null && c.followers > q.maxFollowers) return false;
    if (q.minEngagement != null && c.engagement < q.minEngagement) return false;
    if (q.minAudienceUS != null && c.audience.us < q.minAudienceUS) return false;
    return true;
  });
}

// ------------------------------------------------------- keyword ranking

const STOP = new Set("a an the and or of in on at to for with my i it is that this so you".split(" "));
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map(stem);

// Notes are searchable alongside the bio and posts ("open to paid usage", "delivered early").
const docTokens = new Map(creators.map((c) => [c.id, tokens([c.bio, ...c.captions, ...c.notes.map((n) => n.text)].join(" "))]));
const df = new Map<string, number>();
for (const toks of docTokens.values()) for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (t: string) => Math.log(1 + creators.length / (1 + (df.get(t) ?? 0)));

function clip(s: string, n = 90) {
  return s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)) + "…";
}

/** Query words, with a word nobody has ever written swapped for its nearest neighbour ("sunscrean"). */
const queryTokens = (text: string) => [...new Set(tokens(text).map((t) => (df.has(t) ? t : closest(t, df.keys()) ?? t)))];

function rankByKeywords(pool: Creator[], semantic: string): SearchResult[] {
  const q = queryTokens(semantic);
  return pool.map((creator) => {
    const toks = docTokens.get(creator.id)!;
    let score = 0;
    for (const t of q) {
      const tf = toks.filter((x) => x === t).length;
      if (tf) score += idf(t) * (1 + Math.log(tf));
    }
    // Reward creators that cover every query term over ones repeating a single term.
    const covered = q.filter((t) => toks.includes(t)).length;
    score *= q.length ? covered / q.length : 0;

    const hitsIn = (text: string) => { const tt = tokens(text); return q.filter((t) => tt.includes(t)).length; };
    const posts = creator.captions.map((cap, i) => ({ i, cap, hits: hitsIn(cap) })).filter((p) => p.hits > 0).sort((a, b) => b.hits - a.hits);
    const notes = creator.notes.map((n) => ({ text: n.text, hits: hitsIn(n.text) })).filter((n) => n.hits > 0).sort((a, b) => b.hits - a.hits);
    // Quote whichever matched more of the query: a post, or a CRM note.
    const noteWins = notes.length > 0 && (!posts.length || notes[0].hits > posts[0].hits);
    const reason = noteWins ? `CRM note: “${clip(notes[0].text)}”`
      : posts.length ? `${posts.length} of ${creator.captions.length} recent posts match: “${clip(posts[0].cap)}”`
      : null;
    return { creator, score, reason, matchedPost: posts.length ? posts[0].i : null, warning: null };
  });
}

/** A conflict note is worth a warning when what it covers overlaps the topic being searched. */
function conflictFor(creator: Creator, semantic: string): string | null {
  const q = new Set(queryTokens(semantic));
  const hit = creator.notes.find((n) => n.kind === "conflict" && tokens(n.about ?? n.text).some((t) => q.has(t)));
  return hit ? hit.text : null;
}

// ----------------------------------------------------- embedding ranking

type EmbeddingFile = {
  model: string;
  dims: number | null;
  items: Record<string, { doc: number[]; captions: number[][] }>;
};

let cache: EmbeddingFile | null | undefined;
function loadEmbeddings(): EmbeddingFile | null {
  if (cache !== undefined) return cache;
  try {
    const file = path.join(process.cwd(), "data", "embeddings.json");
    cache = JSON.parse(fs.readFileSync(file, "utf8")) as EmbeddingFile;
  } catch {
    cache = null;
  }
  return cache;
}

export const embeddingsReady = () => !!process.env.OPENAI_API_KEY && !!loadEmbeddings();

const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const cosine = (a: number[], b: number[]) => dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)) || 1);

async function embedQuery(text: string, file: EmbeddingFile): Promise<number[]> {
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: file.model, input: text, ...(file.dims ? { dimensions: file.dims } : {}) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`embeddings HTTP ${res.status}`);
  return (await res.json()).data[0].embedding;
}

async function rankByEmbeddings(pool: Creator[], semantic: string): Promise<SearchResult[]> {
  const file = loadEmbeddings()!;
  const q = await embedQuery(semantic, file);
  return pool.map((creator) => {
    const item = file.items[creator.id];
    if (!item) return { creator, score: 0, reason: null, matchedPost: null, warning: null };
    const sims = item.captions.map((v) => cosine(q, v));
    const best = sims.indexOf(Math.max(...sims));
    // Best single post carries most of the weight; the whole profile breaks ties.
    const score = 0.7 * sims[best] + 0.3 * cosine(q, item.doc);
    return { creator, score, reason: `Closest post: “${clip(creator.captions[best])}”`, matchedPost: best, warning: null };
  });
}

// ------------------------------------------------------------------ search

/** Below this many roster matches, applicants and prospects who fit are returned as a second group. */
export const ROSTER_MIN = 5;

type Ranker = "embeddings" | "keywords" | "reach";

/**
 * Keyword matches scoring below this share of the best match are dropped. Without it, a creator
 * who matches one word of three ("outfits" for "wedding guest outfits") counts as a roster match,
 * pads the roster past ROSTER_MIN and hides the applicants who really fit.
 * Chosen from the eval queries (scripts/eval_queries.json): returned creators were binned by
 * score / best score and labelled relevant or not. The two groups overlap, so no value is clean;
 * the eval was rerun at 0, 0.3, 0.4, 0.5 and 0.6. Mean P@5 rose 0.83 -> 0.88 up to 0.5 while
 * recall held (0.79 -> 0.78); at 0.6 recall fell to 0.60. So 0.5.
 */
const KEYWORD_CUTOFF = Number(process.env.KEYWORD_CUTOFF ?? 0.5);

async function rank(pool: Creator[], semantic: string): Promise<{ ranked: SearchResult[]; ranker: Ranker }> {
  if (!semantic.trim()) {
    // No topic: best photo sets first (this is the first screen of the demo), then recent reach.
    const ranked = pool
      .map((creator) => ({ creator, score: 0, reason: null, matchedPost: null, warning: null }))
      .sort((a, b) => b.creator.images.length - a.creator.images.length || b.creator.recentReach - a.creator.recentReach);
    return { ranked, ranker: "reach" };
  }
  let ranked: SearchResult[] | null = null;
  let ranker: Ranker = "keywords";
  if (embeddingsReady() && process.env.RANKER !== "keywords") {
    try {
      ranked = await rankByEmbeddings(pool, semantic);
      ranker = "embeddings";
    } catch (e) {
      console.warn("embedding ranker failed, using keywords:", e);
    }
  }
  if (!ranked) {
    ranked = rankByKeywords(pool, semantic).filter((r) => r.score > 0);
    const best = Math.max(0, ...ranked.map((r) => r.score));
    ranked = ranked.filter((r) => r.score >= KEYWORD_CUTOFF * best);
  }
  for (const r of ranked) {
    r.warning = conflictFor(r.creator, semantic);
    // A creator who cannot take the brief should not outrank one who can.
    if (r.warning) r.score *= 0.5;
  }
  ranked.sort((a, b) => b.score - a.score || b.creator.recentReach - a.creator.recentReach);
  return { ranked, ranker };
}

export async function search(q: ParsedQuery): Promise<{ results: SearchResult[]; offRoster: SearchResult[]; ranker: Ranker }> {
  const { ranked, ranker } = await rank(applyFilters(q), q.semantic);
  if (q.stages.length)
    return { results: ranked.filter((r) => q.stages.includes(r.creator.stage)), offRoster: [], ranker };

  // Roster first. Only when the roster is thin do we show who would be worth signing.
  const results = ranked.filter((r) => r.creator.stage === "roster");
  const offRoster = results.length < ROSTER_MIN ? ranked.filter((r) => r.creator.stage !== "roster") : [];
  return { results, offRoster, ranker };
}
