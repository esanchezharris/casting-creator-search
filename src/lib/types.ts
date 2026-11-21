export type Stage = "roster" | "applicant" | "prospect";
export const STAGES: Stage[] = ["roster", "applicant", "prospect"];

/** A short CRM note. `about` is set on conflicts: the product category the conflict covers. */
export type Note = {
  kind: "reliability" | "terms" | "conflict" | "status";
  text: string;
  about?: string;
};

export type Creator = {
  id: string;
  name: string;
  handle: string;
  gender: Gender;
  age: number;
  /** Where the creator sits in the pipeline. Only roster creators have a partner, campaigns and a rate. */
  stage: Stage;
  partner: string | null;
  campaigns: number | null;
  niches: string[];
  city: string;
  region: string;
  country: string;
  followers: number;
  engagement: number;
  /** Average views on recent reels. */
  recentReach: number;
  /** Where the audience is, which is not the same as where the creator lives. */
  audience: { us: number; top: string };
  rate: number | null;
  bio: string;
  captions: string[];
  notes: Note[];
  images: string[];
  /** Likes and top comments for each caption, in the same order. */
  reactions: { likes: number; comments: { user: string; text: string }[] }[];
  /** For each photo, the index of the caption it illustrates. */
  photoPosts?: number[];
  /** A short clip shown in quick look. Photos and clips are AI-generated stand-ins (scripts/apply_media.py). */
  video?: string;
  /** Which photo the clip was made from. The clip is shown in that photo's place, never beside it. */
  videoAt?: number;
  /** For each caption, how many days ago it was posted. `images` is ordered newest post first. */
  postDays?: number[];
};

export type Gender = "woman" | "man";
export const GENDERS: Gender[] = ["woman", "man"];

export type LocationFilter = {
  field: "city" | "region" | "country";
  value: string;
  label: string;
};

/** What a natural-language query turns into: hard filters plus free text to rank on. */
export type ParsedQuery = {
  niches: string[];
  locations: LocationFilter[];
  /** Empty means every stage. With a topic in the brief, the roster is then listed first and the rest only if the roster is thin. */
  stages: Stage[];
  /** Empty means anyone. */
  genders: Gender[];
  /** The creator's own age in years, both ends included. */
  minAge: number | null;
  maxAge: number | null;
  minFollowers: number | null;
  maxFollowers: number | null;
  /** The most the brief can pay one creator for a reel, in dollars. Creators with no agreed rate are not excluded by it. */
  maxRate: number | null;
  minEngagement: number | null;
  /** Minimum share of the audience in the US, 0 to 100. */
  minAudienceUS: number | null;
  semantic: string;
  /** Set when the text asked for a shortlist, not only a search: a head count, a total budget, or a whole brief. */
  brief?: BriefAsk | null;
};

/** What a brand's brief asks for beyond who fits: how many, for how much, and on what terms. */
export type BriefAsk = {
  brand: string | null;
  product: string | null;
  /** How many creators the brand wants. */
  count: number | null;
  /** Budget for all of them together, in dollars. */
  totalBudget: number | null;
  /** What each creator makes, in the brief's words ("one reel each"). */
  deliverable: string | null;
  /** A date in the brief's words ("drafts due Feb 20"). */
  deadline: string | null;
  /** The brief rules out anyone tied to a competitor. */
  noConflicts: boolean;
  /** The follower range is a preference ("ideally 50K to 300K"), so a shortlist may stretch it. */
  flexibleSize: boolean;
  /** Figures the model returned that are not written anywhere in the brief. They are not used. */
  dropped: string[];
};

/**
 * One creator in a proposed shortlist. Everyone meets the brief's hard requirements. `note` says
 * what is weaker about this pick, if anything: no recent post about the product, or a follower
 * count just outside a range the brief gave as a preference (`outside`).
 */
export type PlanPick = SearchResult & { note: string | null; outside?: boolean };

/** A shortlist put together from the search results to meet the brief's count and budget. */
export type Plan = {
  /** How many creators the plan aims for: the brief's count, or five. */
  want: number;
  budget: number | null;
  /** In the order they were considered: exact fits first, then the ones that bend something. All have an agreed rate. */
  picks: PlanPick[];
  total: number;
  reach: number;
  /** Applicants and prospects who fit exactly, offered when the roster cannot. No rate, so not in the total. */
  alternates: SearchResult[];
  leftOut: { id: string; name: string; why: string }[];
  /** Plain sentences about where the plan falls short of the brief, or stretches it. */
  notes: string[];
  /** Text to send to the brand. */
  reply: string;
};

export type SearchResult = {
  creator: Creator;
  score: number;
  reason: string | null;
  /** Index into creator.captions of the post that matched best, if one did. */
  matchedPost: number | null;
  /** A conflict note that touches the topic of this search. */
  warning: string | null;
  /** Keyword matches only: no single post or note has every word of the topic. */
  partial?: boolean;
};

export type SearchResponse = {
  parsed: ParsedQuery;
  parser: "llm" | "rules" | "chips";
  ranker: "embeddings" | "keywords" | "hybrid" | "reach";
  results: SearchResult[];
  /** Applicants and prospects who fit, sent only when fewer than five roster creators do. */
  offRoster: SearchResult[];
  /** Place names the "Add filter" control can offer. */
  places: string[];
  /** How many creators carry each filter value, across the whole database, shown beside the options. */
  facets: Record<string, number>;
  /** A proposed shortlist, when the brief asked for one. */
  plan: Plan | null;
  tookMs: number;
};

export const NICHES = [
  "fitness", "running", "beauty", "skincare", "hair",
  "fashion", "streetwear", "lifestyle", "wellness", "food",
] as const;
