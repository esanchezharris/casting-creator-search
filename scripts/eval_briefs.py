"""Score the brief-to-shortlist engine against scripts/eval_briefs.json.

Each case is a whole brief as a brand would send it, with what a careful person would read out
of it. Two things are scored per brief:

  reading   15 fields: the ten filters, the head count, the total budget, "no conflicts",
            whether the follower range was hedged, and whether the topic names the product.
  plan      the proposed shortlist, checked against the data file and the EXPECTED reading, so
            a misread brief shows up as a broken plan:
              priced      every pick is on the roster with an agreed rate
              hard        every pick meets the brief's hard requirements (a hedged follower
                          range may stretch to half the minimum and double the maximum)
              conflict    no pick has a conflict note about the product
              money       the total is the sum of the rates, within the budget, each rate
                          within the per-creator cap
              filled      the list is as long as it can be: the brief's count, or the most
                          the eligible creators and the budget allow
              exact       with no total budget, creators who fit everything and post about the
                          product are all on the list before anyone else
              marked      a pick outside the stated follower range, or with no post about the
                          product, says so

Cases marked "held_out" were written before the engine was run on any brief except the first,
and were not looked at while it was being fixed. Start the app first (npm run dev), then:
    python3 scripts/eval_briefs.py --url http://localhost:3210
    python3 scripts/eval_briefs.py --only dev        # or: held
"""
import argparse
import json
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES = json.loads((HERE / "eval_briefs.json").read_text())
CREATORS = {c["id"]: c for c in json.loads((HERE.parent / "data" / "creators.json").read_text())}
FILTERS = ("niches", "locations", "stages", "genders", "minAge", "maxAge", "minFollowers", "maxFollowers", "maxRate", "minEngagement", "minAudienceUS")


def call(url: str, brief: str) -> dict:
    req = urllib.request.Request(f"{url}/api/search", data=json.dumps({"query": brief}).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def reading(expect: dict, parsed: dict) -> dict[str, bool]:
    f, ask = expect["filters"], parsed.get("brief") or {}
    got = dict(parsed, locations=[l["value"] for l in parsed["locations"]])
    out = {}
    for key in FILTERS:
        want, have = f.get(key, [] if key in ("niches", "locations", "stages", "genders") else None), got.get(key)
        if isinstance(want, list):
            # Asking for both genders is the same as asking for neither.
            if key == "genders" and sorted(have) == ["man", "woman"]:
                have = []
            out[key] = sorted(want) == sorted(have)
        else:
            out[key] = want == have
    out["count"] = expect["count"] == ask.get("count")
    out["totalBudget"] = expect["totalBudget"] == ask.get("totalBudget")
    out["noConflicts"] = expect["noConflicts"] == bool(ask.get("noConflicts"))
    out["flexibleSize"] = expect["flexibleSize"] == bool(ask.get("flexibleSize"))
    out["topic"] = any(t in parsed["semantic"].lower() for t in expect["topic_any"])
    return out


def hard(c: dict, expect: dict, stretch: bool) -> bool:
    f = expect["filters"]
    lo, hi = f.get("minFollowers"), f.get("maxFollowers")
    if stretch and expect["flexibleSize"]:
        lo, hi = (lo / 2 if lo else None), (hi * 2 if hi else None)
    return not (
        (f.get("niches") and not set(f["niches"]) & set(c["niches"]))
        or (f.get("locations") and not any(v in (c["city"], c["region"], c["country"]) for v in f["locations"]))
        or (f.get("genders") and c["gender"] not in f["genders"])
        or (f.get("minAge") and c["age"] < f["minAge"]) or (f.get("maxAge") and c["age"] > f["maxAge"])
        or (lo and c["followers"] < lo) or (hi and c["followers"] > hi)
        or (f.get("maxRate") and c["rate"] is not None and c["rate"] > f["maxRate"])
        or (f.get("minAudienceUS") and c["audience"]["us"] < f["minAudienceUS"])
    )


def conflicted(c: dict, expect: dict) -> bool:
    return any(n["kind"] == "conflict" and any(t in n.get("about", "").lower() for t in expect["conflict_terms"]) for n in c["notes"])


def posts_about(c: dict, expect: dict) -> bool:
    caps = " ".join(c["captions"]).lower()
    return any(t in caps for t in expect["topic_any"])


def plan_checks(expect: dict, plan: dict | None) -> dict[str, bool | None]:
    if not plan:
        return {"plan returned": False}
    picks = [(p, CREATORS[p["creator"]["id"]]) for p in plan["picks"]]
    f, budget, count = expect["filters"], expect["totalBudget"], expect["count"]
    eligible = [c for c in CREATORS.values() if c["stage"] == "roster" and c["rate"] is not None and hard(c, expect, True) and not conflicted(c, expect)]
    cheapest, k, spent = sorted(c["rate"] for c in eligible), 0, 0
    while k < min(count, len(cheapest)) and (budget is None or spent + cheapest[k] <= budget):
        spent += cheapest[k]
        k += 1
    exact = [c for c in eligible if hard(c, expect, False) and posts_about(c, expect)]
    ids = {c["id"] for _, c in picks}
    total = sum(c["rate"] or 0 for _, c in picks)
    return {
        "priced": all(c["stage"] == "roster" and c["rate"] is not None for _, c in picks),
        "hard": all(hard(c, expect, True) for _, c in picks),
        "conflict": not any(conflicted(c, expect) for _, c in picks),
        "money": plan["total"] == total and (budget is None or total <= budget) and all(not f.get("maxRate") or c["rate"] <= f["maxRate"] for _, c in picks),
        "filled": len(picks) == k,
        "exact": None if budget is not None else len(ids & {c["id"] for c in exact}) == min(len(exact), count),
        "marked": all((hard(c, expect, False) or p.get("outside")) and (posts_about(c, expect) or p.get("note")) for p, c in picks),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000")
    ap.add_argument("--only", choices=["dev", "held"])
    args = ap.parse_args()
    cases = [c for c in CASES if not args.only or (args.only == "held") == bool(c["held_out"])]

    rows = []
    for case in cases:
        out = call(args.url, case["brief"])
        read = reading(case["expect"], out["parsed"])
        plan = plan_checks(case["expect"], out.get("plan"))
        rows.append((case, out, read, plan))
        bad_read = [k for k, ok in read.items() if not ok]
        bad_plan = [k for k, ok in plan.items() if ok is False]
        p = out.get("plan") or {"picks": [], "total": 0}
        print(f"{'held' if case['held_out'] else 'dev ':5} {case['id']:22} read {sum(read.values())}/{len(read)}  plan {'ok  ' if not bad_plan else 'FAIL'}"
              f"  {len(p['picks'])}/{case['expect']['count']} picked, ${p['total']:,}" + (f" of ${case['expect']['totalBudget']:,}" if case["expect"]["totalBudget"] else "")
              + f"  [{out['parser']}/{out['ranker']}, {out['tookMs']} ms]")
        if bad_read:
            got = dict(out["parsed"], locations=[l["value"] for l in out["parsed"]["locations"]])
            print(f"{'':28} misread: {', '.join(bad_read)}   got: {json.dumps({k: v for k, v in got.items() if v not in ([], None, '')})}")
        if bad_plan:
            print(f"{'':28} plan broke: {', '.join(bad_plan)}")

    print()
    for name, part in (("dev", [r for r in rows if not r[0]["held_out"]]), ("held out", [r for r in rows if r[0]["held_out"]])):
        if not part:
            continue
        fields = sum(sum(r[2].values()) for r in part)
        of = sum(len(r[2]) for r in part)
        print(f"{name}: fields read {fields}/{of}, briefs read with no mistake {sum(all(r[2].values()) for r in part)}/{len(part)}, "
              f"plans passing every check {sum(not any(v is False for v in r[3].values()) for r in part)}/{len(part)}")


if __name__ == "__main__":
    main()
