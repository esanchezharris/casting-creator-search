import { NextResponse } from "next/server";
import { parseQuery, PLACES, sanitize } from "@/lib/parse";
import { FACETS, search } from "@/lib/search";
import type { SearchResponse } from "@/lib/types";

export const runtime = "nodejs";

const FORCED = ["keywords", "embeddings", "hybrid"];

/**
 * POST { query: string }      parse natural language, then search
 * POST { filters: ParsedQuery } search with filters the user edited as chips
 * Either can add parser: "rules" and ranker: "keywords" | "embeddings" | "hybrid" to force a mode.
 * scripts/eval.py uses that to score every mode against one running server.
 */
export async function POST(req: Request) {
  const started = performance.now();
  const body = await req.json().catch(() => ({}));

  let parsed, parser: SearchResponse["parser"];
  if (body.filters) {
    parsed = sanitize(body.filters);
    parser = "chips";
  } else {
    ({ parsed, parser } = await parseQuery(String(body.query ?? "").slice(0, 3000), body.parser === "rules" ? "rules" : undefined));
  }

  const { results, offRoster, ranker } = await search(parsed, FORCED.includes(body.ranker) ? body.ranker : undefined);
  const payload: SearchResponse = {
    parsed, parser, ranker, results, offRoster, places: PLACES, facets: FACETS, tookMs: Math.round(performance.now() - started),
  };
  return NextResponse.json(payload);
}
