import { NextResponse } from "next/server";
import { parseQuery, PLACES, sanitize } from "@/lib/parse";
import { buildPlan } from "@/lib/plan";
import { FACETS, search, widen } from "@/lib/search";
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
  // A brief that asks for a shortlist may need more people than fit it exactly, either because
  // too few do or because the budget cannot cover the ones who do.
  const wider = parsed.brief ? await widen(parsed, new Set([...results, ...offRoster].map((r) => r.creator.id))) : [];
  const payload: SearchResponse = {
    parsed, parser, ranker, results, offRoster, places: PLACES, facets: FACETS, plan: buildPlan(parsed, results, offRoster, wider), tookMs: Math.round(performance.now() - started),
  };
  return NextResponse.json(payload);
}
