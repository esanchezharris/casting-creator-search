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
  /** Empty means "roster first": roster creators, then the rest if the roster is thin. */
  stages: Stage[];
  /** Empty means anyone. */
  genders: Gender[];
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagement: number | null;
  /** Minimum share of the audience in the US, 0 to 100. */
  minAudienceUS: number | null;
  semantic: string;
};

export type SearchResult = {
  creator: Creator;
  score: number;
  reason: string | null;
  /** Index into creator.captions of the post that matched best, if one did. */
  matchedPost: number | null;
  /** A conflict note that touches the topic of this search. */
  warning: string | null;
};

export type SearchResponse = {
  parsed: ParsedQuery;
  parser: "llm" | "rules" | "chips";
  ranker: "embeddings" | "keywords" | "reach";
  results: SearchResult[];
  /** Applicants and prospects who fit, sent only when fewer than five roster creators do. */
  offRoster: SearchResult[];
  /** Place names the "Add filter" control can offer. */
  places: string[];
  /** How many creators carry each filter value, across the whole database, shown beside the options. */
  facets: Record<string, number>;
  tookMs: number;
};

export const NICHES = [
  "fitness", "running", "beauty", "skincare", "hair",
  "fashion", "streetwear", "lifestyle", "wellness", "food",
] as const;
