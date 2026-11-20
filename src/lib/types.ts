export type Creator = {
  id: string;
  name: string;
  handle: string;
  niches: string[];
  city: string;
  region: string;
  country: string;
  followers: number;
  engagement: number;
  avgViews: number;
  rate: number;
  bio: string;
  captions: string[];
  images: string[];
};

export type LocationFilter = {
  field: "city" | "region" | "country";
  value: string;
  label: string;
};

/** What a natural-language query turns into: hard filters plus free text to rank on. */
export type ParsedQuery = {
  niches: string[];
  locations: LocationFilter[];
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagement: number | null;
  semantic: string;
};

export type SearchResult = {
  creator: Creator;
  score: number;
  reason: string | null;
};

export type SearchResponse = {
  parsed: ParsedQuery;
  parser: "llm" | "rules" | "chips";
  ranker: "embeddings" | "keywords" | "followers";
  results: SearchResult[];
  tookMs: number;
};

export const NICHES = [
  "fitness", "running", "beauty", "skincare", "hair",
  "fashion", "streetwear", "lifestyle", "wellness", "food",
] as const;
