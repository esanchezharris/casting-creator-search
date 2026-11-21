import creatorsJson from "../../data/creators.json";
import { closest } from "./fuzzy";
import { Creator, GENDERS, LocationFilter, NICHES, ParsedQuery, Stage, STAGES } from "./types";

const creators = creatorsJson as Creator[];

export const emptyQuery = (): ParsedQuery => ({
  niches: [], locations: [], stages: [], genders: [], minAge: null, maxAge: null, minFollowers: null, maxFollowers: null, maxRate: null,
  minEngagement: null, minAudienceUS: null, semantic: "",
});

// ---------------------------------------------------------------- gazetteer

const REGION_NAMES: Record<string, string[]> = {
  FL: ["florida"], CA: ["california"], NY: ["new york", "ny"], TX: ["texas"], IL: ["illinois"],
  SC: ["south carolina"], TN: ["tennessee"], GA: ["georgia"], ON: ["ontario"],
};
// First name in each list is the chip label.
const COUNTRY_NAMES: Record<string, string[]> = {
  USA: ["united states", "usa", "u.s.", "america", "the us", "the states", "us-based", "us based", "american"],
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

/** Place names for the "Add filter" control: one label per distinct filter, A to Z. */
export const PLACES: string[] = [...new Set(GAZETTEER.map(([, f]) => f.label))].sort();

export function resolveLocation(text: string): LocationFilter | null {
  const t = text.trim().toLowerCase();
  const hit = GAZETTEER.find(([term]) => term === t);
  if (hit) return hit[1];
  // The model tends to pass a misspelled place through unchanged ("Flordia").
  const names = GAZETTEER.filter(([term, f]) => term === f.label.toLowerCase());
  const near = closest(t, names.map(([term]) => term));
  return near ? names.find(([term]) => term === near)![1] : null;
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

const TERM_TO_NICHE = new Map(Object.entries(NICHE_TERMS).flatMap(([niche, terms]) => terms.map((t) => [t, niche] as const)));
// Words that name a kind of person, so they are always a creator type: "runners", "foodies".
const AGENT_TERMS: Record<string, string> = {
  runner: "running", runners: "running", foodie: "food", foodies: "food", yogi: "wellness", yogis: "wellness",
  lifter: "fitness", lifters: "fitness", sneakerhead: "streetwear", sneakerheads: "streetwear",
};
for (const [t, n] of Object.entries(AGENT_TERMS)) TERM_TO_NICHE.set(t, n);
const CREATOR_NOUNS = new Set("creator creators influencer influencers people person account accounts talent pages girls guys folks".split(" "));
// A niche word right after one of these is a subject, not a creator type: "about running", "for the gym".
const TOPIC_BEFORE = new Set("the a an about for before after at to my their of on review reviews reviewing".split(" "));
// A niche word right before one of these (or at the end) is a creator type: "skincare in New York".
const LINK_AFTER = new Set("in with who that whose over under from based near around above below between only".split(" "));
const JOINERS = new Set(["and", "or", "&", "/", ","]);

const TENS: Record<string, number> = { ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Numbers written as words, so the range rules below only have to read digits. */
function spellOutNumbers(text: string): string {
  return text
    .replace(/(?:a |one )?quarter (?:of a )?million/g, "250000")
    .replace(/half (?:a )?million/g, "500000")
    .replace(/(?:a|one) million/g, "1000000")
    .replace(/(?:a|one) hundred(?= ?(?:k|thousand))/g, "100")
    .replace(new RegExp(String.raw`(?<![a-z])(${Object.keys(TENS).join("|")})(?=\s*(?:k(?![a-z])|thousand|million|and\s|to\s|-))`, "g"), (w) => String(TENS[w]))
    .replace(/(?:no|not) more than|at most|maximum of|a max(?:imum)? of/g, "under")
    .replace(/(?:no|not) (?:less|fewer) than|minimum of|a min(?:imum)? of/g, "over")
    .replace(/(\d[\d.,]*\s*(?:k|m|thousand|million)?)\s+plus(?![a-z])/g, "$1+");
}

const FILLER = new Set(("a an the and or of in on at to for from with who whos that which is are be do does based located " +
  "creator creators influencer influencers people person someone anyone accounts account talent find show me give " +
  "do does doing did post posts posting posted talk talks talking about content make makes making mention mentions " +
  "followers follower following audience has have having their them they i want need looking some any " +
  "whose us we our show list get please brief campaign launch yet already currently " +
  "age aged ages old older younger years year " +
  "budget each per reel rate brand brands least most more less than only").split(" "));

const NUM = String.raw`(\d+(?:[.,]\d+)?)\s*((?:thousand|million|k|m)(?![a-z]))?`;

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
  let rest = " " + spellOutNumbers(query.toLowerCase().replace(/[“”"]/g, " ")) + " ";
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (m) { fn(m); rest = rest.replace(m[0], " "); }
    return !!m;
  };

  // Pipeline stage. "Not signed" has to be read before "signed".
  const addStages = (...st: Stage[]) => { for (const x of st) if (!out.stages.includes(x)) out.stages.push(x); };
  take(/(?:not|n't|never)\s+(?:yet\s+)?(?:been\s+)?signed(?:\s+yet)?|(?<![a-z])unsigned(?![a-z])|not\s+(?:yet\s+)?on\s+(?:the|our)\s+roster(?:\s+yet)?|off[- ]roster|worth\s+signing/,
    () => addStages("applicant", "prospect"));
  take(/(?:already\s+)?(?<![a-z])signed(?![a-z])|(?:on|from|in)\s+(?:the|our)\s+roster|(?<![a-z])roster(?:ed)?(?![a-z])/, () => addStages("roster"));
  take(/(?<![a-z])(?:applicants?|applications?|applied)(?![a-z])/, () => addStages("applicant"));
  take(/(?<![a-z])(?:prospects?|scouted)(?![a-z])/, () => addStages("prospect"));

  // Gender, only from plain words. "Women's running shoes" is a topic, so a possessive is left alone.
  take(/(?<![a-z])(?:women|woman|females?|ladies|girls)(?![a-z'’])/, () => { out.genders.push("woman"); });
  take(/(?<![a-z])(?:men|man|males?|guys)(?![a-z'’])/, () => { out.genders.push("man"); });

  // Budget: a dollar amount is what the brief can pay one creator ("budget $2,000 each", "under $5k a reel").
  // A total for the whole campaign says nothing about one creator's rate, so it is only removed.
  {
    const LEAD = String.raw`(?:(?:with\s+)?(?:a\s+)?(?:total\s+|overall\s+)?(?:budget|rate)s?\s+(?:of\s+|is\s+|around\s+|up to\s+|under\s+)?|(?:under|below|up to|at most|max(?:imum)?|less than|for)\s+)?`;
    const AMOUNT = String.raw`\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k(?![a-z]))?`;
    const TAIL = String.raw`(?:\s+(?:in\s+)?(?:total|overall|altogether|budget))?(?:\s+(?:each|per\s+(?:creator|person|post|reel|video)|a\s+(?:creator|post|reel|video|piece)|or\s+(?:less|under)))*`;
    take(new RegExp(LEAD + AMOUNT + TAIL), (m) => {
      const v = Math.round(parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1));
      if (v > 0 && !/total|overall|altogether/.test(m[0])) out.maxRate = v;
    });
  }

  // Age, before every other number. A bare two-digit number after "over" or "under" is an age
  // ("over 30"); with K, M, % or "followers" after it, it is left for the rules below ("over 30K").
  {
    const UNITS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
    const tens = Object.keys(TENS).join("|"), units = Object.keys(UNITS).join("|");
    const NOT_A_COUNT = String.raw`(?![\d.,]*\d|\s*(?:%|percent|k(?![a-z])|m(?![a-z])|thousand|million|followers|posts|campaigns))`;
    rest = rest
      .replace(/(?<![a-z])(twen|thir|for|fif)ties(?![a-z])/g, (_, t) => `${{ twen: 20, thir: 30, for: 40, fif: 50 }[t as "twen"]}s`)
      .replace(new RegExp(String.raw`((?:over|under|above|below|than|least|most|aged?|ages|turned)\s+)(${tens})(?:[- ](${units}))?(?![a-z])${NOT_A_COUNT}`, "g"),
        (_, lead, t, u) => `${lead}${TENS[t] + (u ? UNITS[u] : 0)}`);
    // "thirty-two" reaches here as "30-two": the tens were already turned into digits above.
    rest = rest.replace(new RegExp(String.raw`((?:over|under|above|below|than|least|most|aged?|ages|turned)\s+)([2-7]0)[- ](${units})(?![a-z])`, "g"),
      (_, lead, t, u) => `${lead}${parseInt(t) + UNITS[u]}`);
    const ok = (n: number) => n >= 16 && n <= 80;
    const YEARS = String.raw`(?:\s*(?:years?|yrs?)(?:[- ]olds?)?|\s*y\/?o)`;
    const set = (lo: number | null, hi: number | null) => { out.minAge = lo; out.maxAge = hi; };
    // "in their 20s", "late twenties", "30-somethings"
    take(/(?:in\s+(?:their|his|her)\s+)?(?:(early|mid|late)[- ]?)?(?<![\d.])([2-6]0)(?:'?s|[- ]?somethings?)(?![a-z0-9])/, (m) => {
      const d = parseInt(m[2]);
      if (m[1] === "early") set(d, d + 3); else if (m[1] === "mid") set(d + 3, d + 6); else if (m[1] === "late") set(d + 7, d + 9); else set(d, d + 9);
    })
    // "aged 25 to 34", "between 25 and 34 years old", "25-34 year olds"
    || take(new RegExp(String.raw`(?:aged?|ages)\s+(?:between\s+)?(\d{2})\s*(?:-|–|to|and)\s*(\d{2})${YEARS}?${NOT_A_COUNT}`), (m) => {
      const a = parseInt(m[1]), b = parseInt(m[2]); if (ok(a) && ok(b)) set(Math.min(a, b), Math.max(a, b));
    })
    || take(new RegExp(String.raw`(?:between\s+)?(?<![\d.])(\d{2})\s*(?:-|–|to|and)\s*(\d{2})${YEARS}`), (m) => {
      const a = parseInt(m[1]), b = parseInt(m[2]); if (ok(a) && ok(b)) set(Math.min(a, b), Math.max(a, b));
    })
    // "aged 30+", "30+ years old"
    || take(new RegExp(String.raw`(?:(?:aged?|ages)\s+(\d{2})\s*\+|(?<![\d.])(\d{2})\s*\+${YEARS})`), (m) => { const n = parseInt(m[1] ?? m[2]); if (ok(n)) set(n, null); })
    // "over 30", "older than 30", "at least 30 years old"; "over" excludes the number itself, "at least" keeps it.
    || take(new RegExp(String.raw`(?<!engagement\s)(?<!rate\s)(over|above|older than|more than|past|at least)\s+(?:the age of\s+)?(\d{2})${YEARS}?${NOT_A_COUNT}`), (m) => {
      const n = parseInt(m[2]); if (ok(n)) set(m[1] === "at least" ? n : n + 1, null);
    })
    || take(new RegExp(String.raw`(?<!engagement\s)(?<!rate\s)(under|below|younger than|less than|at most)\s+(?:the age of\s+)?(\d{2})${YEARS}?${NOT_A_COUNT}`), (m) => {
      const n = parseInt(m[2]); if (ok(n)) set(null, m[1] === "at most" ? n : n - 1);
    })
    // "30 years old", "a 30-year-old"
    || take(new RegExp(String.raw`(?<![\d.])(\d{2})[- ]?(?:years?[- ]olds?|y\/?o)(?![a-z])`), (m) => { const n = parseInt(m[1]); if (ok(n)) set(n, n); });
  }

  // Audience location, before places: "US audience" is about followers, "in Florida" about the creator.
  const US = String.raw`(?<![a-z])(?:u\.?s\.?(?:a\.?)?|united states|american?|stateside)(?![a-z])`;
  const AUD = String.raw`(?:audience|followers|following|viewers|reach)`;
  const pct = (v: string) => Math.max(0, Math.min(100, parseFloat(v)));
  take(new RegExp(String.raw`(?:at least |over |above |more than )?(\d{1,3})\s*%\s*\+?\s*(?:or more )?${US}[- ]?(?:based )?\s*${AUD}`), (m) => { out.minAudienceUS = pct(m[1]); })
  || take(new RegExp(String.raw`${AUD}\s+(?:(?:that'?s|that is|that are|who are|is|are)\s+)?(?:at least |over |above |more than )?(\d{1,3})\s*%\s*\+?\s*(?:in |from )?(?:the )?${US}`), (m) => { out.minAudienceUS = pct(m[1]); })
  // "US audience 60%+", "US audience of at least 60%": the figure after the words.
  || take(new RegExp(String.raw`${US}[- ]?(?:based )?\s*${AUD}\s*(?:of |at |is |:)?\s*(?:at least |over |above |more than )?(\d{1,3})\s*%\s*\+?(?:\s*or more)?`), (m) => { out.minAudienceUS = pct(m[1]); })
  // No number given: "mostly" is read as at least half.
  || take(new RegExp(String.raw`(?:(?:mostly|mainly|majority|primarily|largely|predominantly|strong|big)\s+)?${US}[- ]?(?:based )?\s*${AUD}`), () => { out.minAudienceUS = 50; })
  || take(new RegExp(String.raw`${AUD}\s+(?:(?:that'?s|that is|that are|who are|is|are)\s+)?(?:(?:mostly|mainly|primarily|largely|based)\s+)?(?:in|from)\s+(?:the )?${US}`), () => { out.minAudienceUS = 50; });

  // Engagement next, so its number is not read as a follower count.
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

  // Misspelled places: compare what is left, up to three words at a time, with the canonical names.
  {
    const names = GAZETTEER.filter(([term, f]) => term === f.label.toLowerCase());
    const left = rest.split(/\s+/).filter(Boolean);
    for (let n = 3; n >= 1; n--) {
      for (let i = 0; i + n <= left.length; i++) {
        const phrase = left.slice(i, i + n).join(" ").replace(/[^a-z ]/g, "");
        const hit = closest(phrase, names.filter(([term]) => term.split(" ").length === n).map(([term]) => term));
        if (!hit) continue;
        const filter = names.find(([term]) => term === hit)![1];
        if (!out.locations.some((l) => l.field === filter.field && l.value === filter.value)) out.locations.push(filter);
        rest = rest.replace(left.slice(i, i + n).join(" "), " ");
        left.splice(i, n, ...new Array<string>(n).fill(""));
      }
    }
  }

  // Niches. A niche word is a creator type in "fitness creators" or "skincare in New York", but a
  // topic in "running shoes", "about fitness" or "for the gym". Decide from the words around it.
  const words = [...rest.replace(/skin care/g, "skincare").matchAll(/[a-z0-9][a-z0-9'’-]*|[,&\/]/g)].map((m) => m[0]);
  for (let i = 0; i < words.length; i++) {
    if (!TERM_TO_NICHE.has(words[i]) && !CREATOR_NOUNS.has(words[i]))
      words[i] = closest(words[i], [...TERM_TO_NICHE.keys(), ...CREATOR_NOUNS]) ?? words[i];
  }
  const drop = new Set<number>();
  let lastWasTopic = false;
  words.forEach((w, i) => {
    const niche = TERM_TO_NICHE.get(w);
    if (!niche) return;
    let j = i + 1;
    while (j < words.length && (JOINERS.has(words[j]) || TERM_TO_NICHE.has(words[j]))) j++;
    const next = words[j];
    const prev = words[i - 1];
    let isNiche: boolean;
    let keepAsTopic = false;
    if (next && CREATOR_NOUNS.has(next)) isNiche = true;
    else if (w in AGENT_TERMS) isNiche = true;
    else if (prev && (TOPIC_BEFORE.has(prev) || (JOINERS.has(prev) && lastWasTopic))) isNiche = false;
    else if (!next || LINK_AFTER.has(next)) {
      isNiche = true;
      // "who does pilates": a wellness creator, and pilates is still the thing to look for in posts.
      keepAsTopic = !(NICHES as readonly string[]).includes(w);
    } else isNiche = false;
    lastWasTopic = !isNiche;
    if (isNiche) {
      if (!out.niches.includes(niche)) out.niches.push(niche);
      if (!keepAsTopic) drop.add(i);
    }
  });

  out.semantic = words.filter((w, i) => !drop.has(i) && !JOINERS.has(w) && !FILLER.has(w)).join(" ");
  return out;
}

// ------------------------------------------------------------- LLM parser

const SYSTEM = `You turn a casting request for social media creators into JSON filters.
Return only a JSON object with these keys:
- "niches": array, each one of ${JSON.stringify(NICHES)}. Include a niche only when the request names that TYPE of creator ("fitness creators", "foodies", "yogis"). A topic they post about is not a niche, and you must not infer a niche from the topic.
- "locations": array of place names exactly as a person would write them (city, US state, or country). Empty if none.
- "minFollowers", "maxFollowers": integers or null. "micro" means 10000-100000, "nano" means under 10000, "macro" means over 500000. Leave both null unless the request states a size; never guess one.
- "minEngagement": number (percent) or null.
- "stages": array, each one of ["roster","applicant","prospect"]. Empty unless the request says so. "signed" or "on the roster" means ["roster"]. "applicants" means ["applicant"]. "prospects" means ["prospect"]. "not signed yet" or "worth signing" means ["applicant","prospect"].
- "genders": array, each one of ["woman","man"]. Empty unless the request asks for women or men ("female creators", "guys who..."). A product for women or men ("women's running shoes") is a topic, not a gender.
- "maxRate": the most the brief can pay one creator, in dollars, or null. "budget $2,000 each" means 2000. A total campaign budget is not a rate: leave null.
- "minAge", "maxAge": the creator's own age in whole years, both ends included, or null. "over 30" means minAge 31, "under 25" means maxAge 24, "in their twenties" means 20 to 29. An age is never a follower count.
- "minAudienceUS": number 0-100 or null. The minimum share of the creator's AUDIENCE that is in the US. "US audience" or "mostly American followers" with no number means 50. This is about followers, not where the creator lives: "in Florida" is a location, not an audience filter.
- "semantic": the topic, product or vibe to match against their posts, as a short phrase. Empty string if the request is filters only. It is matched against post captions and CRM notes, so "open to paid usage" or "delivers early" belong here. Never repeat a niche, place, stage or number here.

Examples:
"micro foodies in Chicago with a mostly US audience who post about air fryers" -> {"niches":["food"],"locations":["Chicago"],"stages":[],"genders":[],"minAge":null,"maxAge":null,"minFollowers":10000,"maxFollowers":100000,"maxRate":null,"minEngagement":null,"minAudienceUS":50,"semantic":"air fryers"}
"applicants who post about trail shoes" -> {"niches":[],"locations":[],"stages":["applicant"],"genders":[],"minAge":null,"maxAge":null,"minFollowers":null,"maxFollowers":null,"maxRate":null,"minEngagement":null,"minAudienceUS":null,"semantic":"trail shoes"}
"women who run and review men's trail shoes" -> {"niches":["running"],"locations":[],"stages":[],"genders":["woman"],"minAge":null,"maxAge":null,"minFollowers":null,"maxFollowers":null,"maxRate":null,"minEngagement":null,"minAudienceUS":null,"semantic":"men's trail shoes"}
"fitness creators who are over 30" -> {"niches":["fitness"],"locations":[],"stages":[],"genders":[],"minAge":31,"maxAge":null,"minFollowers":null,"maxFollowers":null,"maxRate":null,"minEngagement":null,"minAudienceUS":null,"semantic":""}
"a snack for after the gym" -> {"niches":[],"locations":[],"stages":[],"genders":[],"minAge":null,"maxAge":null,"minFollowers":null,"maxFollowers":null,"maxRate":null,"minEngagement":null,"minAudienceUS":null,"semantic":"a snack for after the gym"}`;

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
      // Chips send back the filter itself; keep it if it is one we know, so a city is not re-read as its state.
      const known = l && typeof l === "object"
        ? GAZETTEER.find(([, g]) => g.field === (l as LocationFilter).field && g.value === (l as LocationFilter).value)?.[1] : null;
      const f = typeof l === "string" ? resolveLocation(l)
        : known ?? (l && typeof l === "object" ? resolveLocation(String((l as LocationFilter).label ?? "")) : null);
      if (f && !out.locations.some((x) => x.field === f.field && x.value === f.value)) out.locations.push(f);
    }
  }
  out.minFollowers = num(r.minFollowers);
  out.maxFollowers = num(r.maxFollowers);
  out.minEngagement = num(r.minEngagement);
  if (Array.isArray(r.stages))
    out.stages = STAGES.filter((st) => (r.stages as unknown[]).some((x) => typeof x === "string" && x.toLowerCase() === st));
  if (Array.isArray(r.genders))
    out.genders = GENDERS.filter((g) => (r.genders as unknown[]).some((x) => typeof x === "string" && x.toLowerCase() === g));
  const rate = num(r.maxRate);
  out.maxRate = rate == null ? null : Math.round(rate);
  const age = (v: unknown) => { const n = num(v); return n == null ? null : Math.max(16, Math.min(80, Math.round(n))); };
  out.minAge = age(r.minAge);
  out.maxAge = age(r.maxAge);
  if (out.minAge != null && out.maxAge != null && out.minAge > out.maxAge) [out.minAge, out.maxAge] = [out.maxAge, out.minAge];
  const us = num(r.minAudienceUS);
  out.minAudienceUS = us == null ? null : Math.min(100, Math.round(us));
  if (out.minFollowers != null && out.maxFollowers != null && out.minFollowers > out.maxFollowers)
    [out.minFollowers, out.maxFollowers] = [out.maxFollowers, out.minFollowers];
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
      temperature: 0,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: query }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`LLM parser HTTP ${res.status}`);
  const data = await res.json();
  const parsed = sanitize(JSON.parse(data.choices[0].message.content));
  // Cross-check: the model sometimes returns filters and forgets the topic. If the rule parser
  // found one in the same sentence, keep it rather than silently searching on filters alone.
  const rules = parseWithRules(query);
  if (!parsed.semantic) parsed.semantic = rules.semantic;
  // Gender is read from plain words, which the rules do exactly; the model is not asked to guess it.
  parsed.genders = rules.genders;
  // So is a budget, and neither the amount nor the words around a campaign belong in the topic.
  parsed.maxRate = rules.maxRate;
  parsed.semantic = parsed.semantic
    .replace(/(?:budget\s+(?:of\s+)?)?\$\s*\d[\d,.]*k?(?:\s+(?:each|per\s+\w+|budget))?/gi, " ")
    .replace(/\s+(?:launch|campaign|brand)\s*$/i, "").replace(/^for\s+(?:an?\s+|the\s+)?/i, "").replace(/\s+/g, " ").trim();
  // Age is read the same way. And when the only number in the sentence was an age, a follower
  // bound from the model is that age misread ("over 30" came back as over 500K followers).
  parsed.minAge = rules.minAge;
  parsed.maxAge = rules.maxAge;
  if ((rules.minAge ?? rules.maxAge) != null && rules.minFollowers == null && rules.maxFollowers == null) {
    if ((parsed.minFollowers ?? parsed.maxFollowers) != null) console.warn("LLM parser: follower bound dropped, the number in the brief was an age");
    parsed.minFollowers = parsed.maxFollowers = null;
    parsed.semantic = parsed.semantic.replace(/\b(?:over|under|above|below|aged?)\s+\d{2}\b|\b\d{2}\s*\+/gi, " ").replace(/\s+/g, " ").trim();
  }
  // Numbers are where the model slips ("50K+" came back as 500000) and where the rules are
  // exact. When the rules read a figure out of the sentence, theirs wins.
  for (const key of ["minFollowers", "maxFollowers", "minEngagement", "minAudienceUS"] as const) {
    if (rules[key] != null && rules[key] !== parsed[key]) {
      console.warn(`LLM parser: ${key} ${parsed[key]} replaced by ${rules[key]} from the rule parser`);
      parsed[key] = rules[key];
    }
  }
  return parsed;
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
