import creatorsJson from "../../data/creators.json";
import { Creator, LocationFilter, NICHES, ParsedQuery } from "./types";

const creators = creatorsJson as Creator[];

export const emptyQuery = (): ParsedQuery => ({
  niches: [], locations: [], minFollowers: null, maxFollowers: null, minEngagement: null, semantic: "",
});

// ---------------------------------------------------------------- gazetteer

const REGION_NAMES: Record<string, string[]> = {
  FL: ["florida"], CA: ["california"], NY: ["new york", "ny"], TX: ["texas"], IL: ["illinois"],
  SC: ["south carolina"], TN: ["tennessee"], GA: ["georgia"], ON: ["ontario"],
};
// First name in each list is the chip label.
const COUNTRY_NAMES: Record<string, string[]> = {
  USA: ["united states", "usa", "u.s.", "america"],
  CAN: ["canada"],
  GBR: ["united kingdom", "uk", "england", "britain"],
  NLD: ["netherlands", "holland"],
  AUS: ["australia"],
};
const CITY_ALIASES: Record<string, string[]> = {
  "New York": ["nyc", "new york city"],
  "Los Angeles": ["la", "l.a."],
};
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** term -> filter, longest terms first so "new york city" wins over "new york". */
const GAZETTEER: [string, LocationFilter][] = (() => {
  const out = new Map<string, LocationFilter>();
  for (const [code, names] of Object.entries(COUNTRY_NAMES))
    for (const n of names) out.set(n, { field: "country", value: code, label: title(names[0]) });
  for (const c of new Set(creators.map((c) => c.city)))
    out.set(c.toLowerCase(), { field: "city", value: c, label: c });
  for (const [city, aliases] of Object.entries(CITY_ALIASES))
    for (const a of aliases) out.set(a, { field: "city", value: city, label: city });
  // Regions last so "new york" means the state, which also covers the city.
  for (const [code, names] of Object.entries(REGION_NAMES))
    for (const n of names) out.set(n, { field: "region", value: code, label: title(names[0]) });
  return [...out.entries()].sort((a, b) => b[0].length - a[0].length);
})();

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (term: string) => new RegExp(`(?<![a-z0-9])${esc(term)}(?![a-z0-9])`, "i");

export function resolveLocation(text: string): LocationFilter | null {
  const t = text.trim().toLowerCase();
  const hit = GAZETTEER.find(([term]) => term === t);
  return hit ? hit[1] : null;
}

// ------------------------------------------------------------ rule parser

const NICHE_TERMS: Record<string, string[]> = {
  fitness: ["fitness", "gym", "workout", "lifting", "weightlifting", "crossfit"],
  running: ["running", "runner", "runners", "marathon"],
  beauty: ["beauty", "makeup"],
  skincare: ["skincare", "skin care"],
  hair: ["hair", "haircare"],
  fashion: ["fashion", "style", "outfit", "outfits", "ootd"],
  streetwear: ["streetwear", "sneaker", "sneakers"],
  lifestyle: ["lifestyle"],
  wellness: ["wellness", "yoga", "pilates"],
  food: ["food", "foodie", "cooking", "recipes"],
};

const FILLER = new Set(("a an the and or of in on at to for from with who whos that which is are be do does based located " +
  "creator creators influencer influencers people person someone anyone accounts account talent find show me give " +
  "do does doing did post posts posting posted talk talks talking about content make makes making mention mentions " +
  "followers follower following audience has have having their them they i want need looking some any").split(" "));

const NUM = String.raw`(\d+(?:[.,]\d+)?)\s*(k|m|thousand|million)?`;

function toNumber(n: string, suffix?: string): number {
  const v = parseFloat(n.replace(",", suffix ? "." : ""));
  const s = (suffix ?? "").toLowerCase();
  if (s === "k" || s === "thousand") return Math.round(v * 1_000);
  if (s === "m" || s === "million") return Math.round(v * 1_000_000);
  return Math.round(v);
}

/**
 * Deterministic baseline parser. Runs with no API key, and is the fallback
 * whenever the LLM parser errors or returns something invalid.
 */
export function parseWithRules(query: string): ParsedQuery {
  const out = emptyQuery();
  let rest = " " + query.toLowerCase().replace(/[“”"]/g, " ") + " ";
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (m) { fn(m); rest = rest.replace(m[0], " "); }
    return !!m;
  };

  // Engagement first, so its number is not read as a follower count.
  take(new RegExp(String.raw`engagement(?: rate)?\s*(?:over|above|at least|of at least|>=?|more than)\s*(\d+(?:\.\d+)?)\s*%?`), (m) => { out.minEngagement = parseFloat(m[1]); });
  take(/(\d+(?:\.\d+)?)\s*%\s*\+?\s*(?:or (?:higher|more)\s*)?engagement(?: rate)?/, (m) => { out.minEngagement = parseFloat(m[1]); });
  take(/(?:high|strong|good) engagement/, () => { out.minEngagement = 5; });

  // Follower ranges, then one-sided bounds.
  const range = take(new RegExp(String.raw`(?:between\s+)?${NUM}\s*(?:-|–|to|and)\s*${NUM}(?:\s*followers)?`), (m) => {
    const hiSuffix = m[4];
    const lo = toNumber(m[1], m[2] ?? hiSuffix);
    const hi = toNumber(m[3], hiSuffix);
    if (hi >= 1000) { out.minFollowers = Math.min(lo, hi); out.maxFollowers = Math.max(lo, hi); }
  });
  if (!range) {
    take(new RegExp(String.raw`(?:under|below|less than|fewer than|up to|max(?:imum)?|<=?)\s*${NUM}`), (m) => {
      const v = toNumber(m[1], m[2]); if (v >= 1000) out.maxFollowers = v;
    });
    take(new RegExp(String.raw`(?:over|above|more than|at least|min(?:imum)?|>=?)\s*${NUM}`), (m) => {
      const v = toNumber(m[1], m[2]); if (v >= 1000) out.minFollowers = v;
    });
    take(new RegExp(String.raw`${NUM}\s*\+`), (m) => {
      const v = toNumber(m[1], m[2]); if (v >= 1000) out.minFollowers = v;
    });
  }
  take(/(?<![a-z])nano(?:[- ]influencers?)?(?![a-z])/, () => { out.maxFollowers ??= 10_000; });
  take(/(?<![a-z])micro(?:[- ]influencers?)?(?![a-z])/, () => { out.minFollowers ??= 10_000; out.maxFollowers ??= 100_000; });
  take(/(?<![a-z])macro(?:[- ]influencers?)?(?![a-z])/, () => { out.minFollowers ??= 500_000; });

  for (const [term, filter] of GAZETTEER) {
    const re = wordRe(term);
    if (re.test(rest)) {
      rest = rest.replace(re, " ");
      if (!out.locations.some((l) => l.field === filter.field && l.value === filter.value)) out.locations.push(filter);
    }
  }

  for (const [niche, terms] of Object.entries(NICHE_TERMS)) {
    for (const term of terms) {
      const re = wordRe(term);
      if (re.test(rest)) {
        rest = rest.replace(re, " ");
        if (!out.niches.includes(niche)) out.niches.push(niche);
      }
    }
  }

  out.semantic = rest.split(/[^a-z0-9'-]+/).filter((w) => w && !FILLER.has(w)).join(" ");
  return out;
}

// ------------------------------------------------------------- LLM parser

const SYSTEM = `You turn a casting request for social media creators into JSON filters.
Return only a JSON object with these keys:
- "niches": array, each one of ${JSON.stringify(NICHES)}. Include a niche only when the request asks for that TYPE of creator ("fitness creators"). A topic they post about ("running shoes") is not a niche.
- "locations": array of place names exactly as a person would write them (city, US state, or country). Empty if none.
- "minFollowers", "maxFollowers": integers or null. "micro" means 10000-100000, "nano" means under 10000, "macro" means over 500000.
- "minEngagement": number (percent) or null.
- "semantic": the topic, product or vibe to match against their posts, as a short phrase. Empty string if the request is filters only. Never repeat a niche, place or number here.`;

export const llmConfigured = () => !!process.env.OPENAI_API_KEY;

/** Clamp whatever came back (LLM output or client chips) to the schema. */
export function sanitize(raw: unknown): ParsedQuery {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);
  const out = emptyQuery();
  if (Array.isArray(r.niches))
    out.niches = [...new Set(r.niches.filter((n): n is string => typeof n === "string").map((n) => n.toLowerCase()))]
      .filter((n) => (NICHES as readonly string[]).includes(n));
  if (Array.isArray(r.locations)) {
    for (const l of r.locations) {
      const f = typeof l === "string" ? resolveLocation(l)
        : l && typeof l === "object" ? resolveLocation(String((l as LocationFilter).label ?? "")) : null;
      if (f && !out.locations.some((x) => x.field === f.field && x.value === f.value)) out.locations.push(f);
    }
  }
  out.minFollowers = num(r.minFollowers);
  out.maxFollowers = num(r.maxFollowers);
  out.minEngagement = num(r.minEngagement);
  out.semantic = typeof r.semantic === "string" ? r.semantic.trim().slice(0, 200) : "";
  return out;
}

export async function parseWithLLM(query: string): Promise<ParsedQuery> {
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: query }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`LLM parser HTTP ${res.status}`);
  const data = await res.json();
  return sanitize(JSON.parse(data.choices[0].message.content));
}

/** LLM when configured, rules otherwise or on any failure. */
export async function parseQuery(query: string): Promise<{ parsed: ParsedQuery; parser: "llm" | "rules" }> {
  if (!query.trim()) return { parsed: emptyQuery(), parser: "rules" };
  if (llmConfigured() && process.env.PARSER !== "rules") {
    try {
      return { parsed: await parseWithLLM(query), parser: "llm" };
    } catch (e) {
      console.warn("LLM parser failed, using rules:", e);
    }
  }
  return { parsed: parseWithRules(query), parser: "rules" };
}
