import { NextResponse } from "next/server";
import { parseQuery, sanitize } from "@/lib/parse";
import { search } from "@/lib/search";
import type { SearchResponse } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST { query: string }      parse natural language, then search
 * POST { filters: ParsedQuery } search with filters the user edited as chips
 */
export async function POST(req: Request) {
  const started = performance.now();
  const body = await req.json().catch(() => ({}));

  let parsed, parser: SearchResponse["parser"];
  if (body.filters) {
    parsed = sanitize(body.filters);
    parser = "chips";
  } else {
    ({ parsed, parser } = await parseQuery(String(body.query ?? "").slice(0, 300)));
  }

  const { results, ranker } = await search(parsed);
  const payload: SearchResponse = {
    parsed, parser, ranker, results, tookMs: Math.round(performance.now() - started),
  };
  return NextResponse.json(payload);
}
