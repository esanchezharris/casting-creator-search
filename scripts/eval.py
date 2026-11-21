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
the API. Cases marked "held_out" were written after the parser fixes and are
reported separately, because the other cases were used to find those fixes. It follows the product's roster-first rule: with no stage asked for,
the expected set is the relevant roster creators, plus relevant applicants and
prospects only when fewer than five roster creators qualify.

Start the app first (npm run dev), then:
    python3 scripts/eval.py
    python3 scripts/eval.py --url http://localhost:3210
    python3 scripts/eval.py --parser rules --ranker keywords   # force a mode on the same server
"""
import argparse
import json
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES = json.loads((HERE / "eval_queries.json").read_text())
CREATORS = json.loads((HERE.parent / "data" / "creators.json").read_text())
ROSTER_MIN = 5  # keep in step with src/lib/search.ts


FORCE: dict = {}  # parser / ranker to force, from the command line


def call(url: str, query: str) -> dict:
    req = urllib.request.Request(
        f"{url}/api/search", data=json.dumps({"query": query, **FORCE}).encode(),
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
    # Gender is checked on every case: reading one where none was asked for would silently drop people.
    if sorted(expected.get("genders", [])) != sorted(parsed.get("genders", [])):
        return False
    for key in ("minFollowers", "maxFollowers", "minEngagement", "minAudienceUS"):
        if key in expected and expected[key] != parsed[key]:
            return False
    # Age too is checked on every case, for the same reason as gender.
    for key in ("minAge", "maxAge", "maxRate"):
        if expected.get(key) != parsed.get(key):
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
    if f.get("genders") and c["gender"] not in f["genders"]:
        return False
    if f.get("maxRate") and c["rate"] is not None and c["rate"] > f["maxRate"]:
        return False
    if f.get("minAge") and c["age"] < f["minAge"]:
        return False
    if f.get("maxAge") and c["age"] > f["maxAge"]:
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


def score(url: str, case: dict) -> dict:
    out = call(url, case["query"])
    shown = out["results"] + out["offRoster"]
    row = {"case": case, "parsed": out["parsed"], "filters": filters_ok(case.get("filters", {}), out["parsed"]),
           "mode": f"parser={out['parser']} ranker={out['ranker'] if out['ranker'] != 'reach' else 'none (no topic)'}",
           "p": None, "r": None, "empty": None, "note": ""}
    has_topic = "relevant_if_caption_has" in case or "relevant_if_note_has" in case
    truth = ground_truth(case) if has_topic else set()
    # A case can ask for nobody outright, or the data can simply hold nobody who fits.
    if case.get("expect_empty") or (has_topic and not truth):
        row["empty"] = not shown
        row["note"] = "nobody fits, nobody returned" if not shown else f"nobody fits, but {len(shown)} returned"
    elif has_topic:
        top = shown[:5]
        # Empty results score zero: returning nobody when someone fits is a miss.
        row["p"] = sum(relevant(r["creator"], case) for r in top) / len(top) if top else 0.0
        row["r"] = len(truth & {x["creator"]["id"] for x in shown}) / len(truth)
        row["note"] = f"{len(truth)} expected, {len(shown)} returned"
    return row


def summary(name: str, rows: list[dict]) -> None:
    ps = [r["p"] for r in rows if r["p"] is not None]
    rs = [r["r"] for r in rows if r["r"] is not None]
    es = [r["empty"] for r in rows if r["empty"] is not None]
    line = f"{name}: filters {sum(r['filters'] for r in rows)}/{len(rows)}"
    if ps:
        line += f", mean P@5 {sum(ps) / len(ps):.2f} and mean recall {sum(rs) / len(rs):.2f} over {len(ps)} topic queries"
    if es:
        line += f", nobody-fits {sum(es)}/{len(es)}"
    print(line)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000")
    ap.add_argument("--quiet", action="store_true", help="only print the summary")
    ap.add_argument("--parser", choices=["rules"], help="force the rule parser")
    ap.add_argument("--ranker", choices=["keywords", "embeddings", "hybrid"], help="force a ranker")
    args = ap.parse_args()
    FORCE.update({k: v for k, v in (("parser", args.parser), ("ranker", args.ranker)) if v})

    rows = [score(args.url, case) for case in CASES]
    if not args.quiet:
        print(f"{'filters':8} {'P@5':>5} {'recall':>6}  query")
        for r in rows:
            fmt = lambda v: "    -" if v is None else f"{v:5.2f}"
            print(f"{'pass' if r['filters'] else 'FAIL':8} {fmt(r['p'])} {fmt(r['r']):>6}  {r['case']['query']}"
                  + (f"   [{r['note']}]" if r["note"] else ""))
            if not r["filters"]:
                parsed = dict(r["parsed"], locations=[l["value"] for l in r["parsed"]["locations"]])
                print(f"{'':22} parsed: {json.dumps({k: v for k, v in parsed.items() if v not in ([], None, '')})}")
        print()
    print("; ".join(sorted({r["mode"] for r in rows})))
    # Held-out cases were written after the parser fixes and never tuned against.
    tuned = [r for r in rows if not r["case"].get("held_out")]
    held = [r for r in rows if r["case"].get("held_out")]
    summary("all", rows)
    if held:
        summary("tuned on", tuned)
        summary("held out", held)


if __name__ == "__main__":
    main()
