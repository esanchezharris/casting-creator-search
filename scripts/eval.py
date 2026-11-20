"""Score the search API against scripts/eval_queries.json.

Two numbers per run:
  filters   did the parser extract the expected niches, places and ranges?
  P@5       share of the top five results (or fewer, if fewer came back)
            that have a post on the topic

Start the app first (npm run dev), then:
    python3 scripts/eval.py
    python3 scripts/eval.py --url https://your-deploy.vercel.app
"""
import argparse
import json
import urllib.request
from pathlib import Path

CASES = json.loads((Path(__file__).parent / "eval_queries.json").read_text())


def call(url: str, query: str) -> dict:
    req = urllib.request.Request(
        f"{url}/api/search", data=json.dumps({"query": query}).encode(),
        headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def filters_ok(expected: dict, parsed: dict) -> bool:
    if "niches" in expected and sorted(expected["niches"]) != sorted(parsed["niches"]):
        return False
    if "locations" in expected and sorted(expected["locations"]) != sorted(l["value"] for l in parsed["locations"]):
        return False
    for key in ("minFollowers", "maxFollowers", "minEngagement"):
        if key in expected and expected[key] != parsed[key]:
            return False
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000")
    args = ap.parse_args()

    f_pass, p_sum, p_n = 0, 0.0, 0
    mode = None
    print(f"{'filters':8} {'P@5':>5}  query")
    for case in CASES:
        out = call(args.url, case["query"])
        mode = mode or f"parser={out['parser']} ranker={out['ranker']}"
        ok = filters_ok(case.get("filters", {}), out["parsed"])
        f_pass += ok
        p_txt = "    -"
        terms = case.get("relevant_if_caption_has")
        if terms:
            top = out["results"][:5]
            hits = sum(any(t in c.lower() for c in r["creator"]["captions"] for t in terms) for r in top)
            # Empty results score zero: returning nobody is a miss, not a pass.
            p = hits / len(top) if top else 0.0
            p_sum += p
            p_n += 1
            p_txt = f"{p:5.2f}"
        print(f"{'pass' if ok else 'FAIL':8} {p_txt}  {case['query']}")
        if not ok:
            print(f"{'':15} parsed: {json.dumps(out['parsed'])}")
    print(f"\n{mode}")
    print(f"filters correct: {f_pass}/{len(CASES)}")
    print(f"mean P@5 over {p_n} topic queries: {p_sum / p_n:.2f}")


if __name__ == "__main__":
    main()
