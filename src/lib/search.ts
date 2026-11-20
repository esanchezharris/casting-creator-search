import fs from "node:fs";
import path from "node:path";
import creatorsJson from "../../data/creators.json";
import { Creator, ParsedQuery, SearchResult } from "./types";

export const creators = creatorsJson as Creator[];

// ------------------------------------------------------------------ filters

export function applyFilters(q: ParsedQuery): Creator[] {
  return creators.filter((c) => {
    if (q.niches.length && !q.niches.some((n) => c.niches.includes(n))) return false;
    if (q.locations.length && !q.locations.some((l) => c[l.field] === l.value)) return false;
    if (q.minFollowers != null && c.followers < q.minFollowers) return false;
    if (q.maxFollowers != null && c.followers > q.maxFollowers) return false;
    if (q.minEngagement != null && c.engagement < q.minEngagement) return false;
    return true;
  });
}

// ------------------------------------------------------- keyword ranking

const STOP = new Set("a an the and or of in on at to for with my i it is that this so you".split(" "));
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map(stem);

const docTokens = new Map(creators.map((c) => [c.id, tokens([c.bio, ...c.captions].join(" "))]));
const df = new Map<string, number>();
for (const toks of docTokens.values()) for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (t: string) => Math.log(1 + creators.length / (1 + (df.get(t) ?? 0)));

function clip(s: string, n = 90) {
  return s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)) + "…";
}

function rankByKeywords(pool: Creator[], semantic: string): SearchResult[] {
  const q = [...new Set(tokens(semantic))];
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

    const perCaption = creator.captions.map((cap) => {
      const ct = tokens(cap);
      return { cap, hits: q.filter((t) => ct.includes(t)).length };
    });
    const matching = perCaption.filter((p) => p.hits > 0).sort((a, b) => b.hits - a.hits);
    const reason = matching.length
      ? `${matching.length} of ${creator.captions.length} recent posts match: “${clip(matching[0].cap)}”`
      : null;
    return { creator, score, reason };
  });
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
    if (!item) return { creator, score: 0, reason: null };
    const sims = item.captions.map((v) => cosine(q, v));
    const best = sims.indexOf(Math.max(...sims));
    // Best single post carries most of the weight; the whole profile breaks ties.
    const score = 0.7 * sims[best] + 0.3 * cosine(q, item.doc);
    return { creator, score, reason: `Closest post: “${clip(creator.captions[best])}”` };
  });
}

// ------------------------------------------------------------------ search

export async function search(q: ParsedQuery): Promise<{ results: SearchResult[]; ranker: "embeddings" | "keywords" | "followers" }> {
  const pool = applyFilters(q);
  const byFollowers = () => pool
    .map((creator) => ({ creator, score: 0, reason: null }))
    .sort((a, b) => b.creator.followers - a.creator.followers);

  if (!q.semantic.trim()) return { results: byFollowers(), ranker: "followers" };

  if (embeddingsReady() && process.env.RANKER !== "keywords") {
    try {
      const results = (await rankByEmbeddings(pool, q.semantic)).sort((a, b) => b.score - a.score);
      return { results, ranker: "embeddings" };
    } catch (e) {
      console.warn("embedding ranker failed, using keywords:", e);
    }
  }
  const results = rankByKeywords(pool, q.semantic).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  return { results, ranker: "keywords" };
}
