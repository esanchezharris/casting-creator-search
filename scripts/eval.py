"""Score the search API against scripts/eval_queries.json.

Per run:
  filters   did the parser extract the expected niches, places, stages and ranges?
  P@5       share of the first five creators shown (fewer if fewer came back)
            that are relevant to the topic
  recall    of the creators in data/creators.json that pass the EXPECTED filters
            and are relevant, the share that came back at all
  empty     for queries where nobody in the data fits, did nobody come back?

"Relevant" means a post (or, for note queries, a CRM note) contains one of the
case's terms. The ground truth is computed here from the data file, never from
the API. It follows the product's roster-first rule: with no stage asked for,
the expected set is the relevant roster creators, plus relevant applicants and
prospects only when fewer than five roster creators qualify.

Start the app first (npm run dev), then:
    python3 scripts/eval.py
    python3 scripts/eval.py --url http://localhost:3210
"""
import argparse
import json
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES = json.loads((HERE / "eval_queries.json").read_text())
CREATORS = json.loads((HERE.parent / "data" / "creators.json").read_text())
ROSTER_MIN = 5  # keep in step with src/lib/search.ts


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
    if "stages" in expected and sorted(expected["stages"]) != sorted(parsed["stages"]):
        return False
    for key in ("minFollowers", "maxFollowers", "minEngagement", "minAudienceUS"):
        if key in expected and expected[key] != parsed[key]:
            return False
    return True


def relevant(c: dict, case: dict) -> bool:
    caps = " ".join(c["captions"]).lower()
    notes = " ".join(n["text"] for n in c["notes"]).lower()
    return (any(t in caps for t in case.get("relevant_if_caption_has", []))
            or any(t in notes for t in case.get("relevant_if_note_has", [])))


def passes(c: dict, f: dict) -> bool:
    if f.get("niches") and not set(f["niches"]) & set(c["niches"]):
        return False
    if f.get("locations") and not any(v in (c["city"], c["region"], c["country"]) for v in f["locations"]):
        return False
    if f.get("minFollowers") and c["followers"] < f["minFollowers"]:
        return False
    if f.get("maxFollowers") and c["followers"] > f["maxFollowers"]:
        return False
    if f.get("minEngagement") and c["engagement"] < f["minEngagement"]:
        return False
    if f.get("minAudienceUS") and c["audience"]["us"] < f["minAudienceUS"]:
        return False
    return True


def ground_truth(case: dict) -> set[str]:
    f = case.get("filters", {})
    fit = [c for c in CREATORS if passes(c, f) and relevant(c, case)]
    if f.get("stages"):
        return {c["id"] for c in fit if c["stage"] in f["stages"]}
    roster = [c for c in fit if c["stage"] == "roster"]
    return {c["id"] for c in (roster if len(roster) >= ROSTER_MIN else fit)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000")
    ap.add_argument("--quiet", action="store_true", help="only print the summary")
    args = ap.parse_args()

    f_pass = f_n = 0
    p_sum = r_sum = 0.0
    p_n = r_n = 0
    e_pass = e_n = 0
    modes: set[str] = set()
    rows = []
    for case in CASES:
        out = call(args.url, case["query"])
        modes.add(f"parser={out['parser']} ranker={out['ranker'] if out['ranker'] != 'reach' else 'none (no topic)'}")
        shown = out["results"] + out["offRoster"]
        ok = filters_ok(case.get("filters", {}), out["parsed"])
        f_pass += ok
        f_n += 1
        p_txt = r_txt = "    -"
        note = ""
        has_topic = "relevant_if_caption_has" in case or "relevant_if_note_has" in case
        truth = ground_truth(case) if has_topic else set()
        # A case can ask for nobody outright, or the data can simply hold nobody who fits.
        if case.get("expect_empty") or (has_topic and not truth):
            e_n += 1
            e_pass += not shown
            note = "nobody fits, nobody returned" if not shown else f"nobody fits, but {len(shown)} returned"
        elif has_topic:
            top = shown[:5]
            # Empty results score zero: returning nobody when someone fits is a miss.
            p = sum(relevant(r["creator"], case) for r in top) / len(top) if top else 0.0
            p_sum += p
            p_n += 1
            p_txt = f"{p:5.2f}"
            r = len(truth & {x["creator"]["id"] for x in shown}) / len(truth)
            r_sum += r
            r_n += 1
            r_txt = f"{r:5.2f}"
            note = f"{len(truth)} expected, {len(shown)} returned"
        rows.append((ok, p_txt, r_txt, case["query"], note, out["parsed"]))

    if not args.quiet:
        print(f"{'filters':8} {'P@5':>5} {'recall':>6}  query")
        for ok, p_txt, r_txt, query, note, parsed in rows:
            print(f"{'pass' if ok else 'FAIL':8} {p_txt} {r_txt:>6}  {query}" + (f"   [{note}]" if note else ""))
            if not ok:
                parsed["locations"] = [l["value"] for l in parsed["locations"]]
                print(f"{'':22} parsed: {json.dumps({k: v for k, v in parsed.items() if v not in ([], None, '')})}")
    print()
    print("; ".join(sorted(modes)))
    print(f"filters correct: {f_pass}/{f_n}")
    print(f"mean P@5 over {p_n} topic queries: {p_sum / p_n:.2f}" if p_n else "no topic queries")
    print(f"mean recall over {r_n} topic queries: {r_sum / r_n:.2f}" if r_n else "no recall cases")
    if e_n:
        print(f"queries that should return nobody: {e_pass}/{e_n} correct")


if __name__ == "__main__":
    main()
