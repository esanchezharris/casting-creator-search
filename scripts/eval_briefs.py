"""Score how a whole pasted brief is read, against scripts/eval_briefs.json.

Each case is a brief as a brand would send it (an email, several lines), with what a careful
person would read out of it. The app turns the brief into the same filters a one-line search
produces; a person then picks from the grid. Two things are reported per brief:

  reading   12 fields: the eleven filters (a total campaign budget must NOT become a rate per
            creator, and a head count must not become anything) and whether the topic names the
            product.
  shown     who the grid then shows: how many on the roster and how many not signed yet, whether
            every one of them meets the requirements a careful reader would set (checked against
            the data file, not the app's own reading), and how many of the first five have a
            post about the product. "About the product" is a substring match on the captions
            using the case's "topic_any" words, which are loose ("makeup" counts for a skin
            tint), so read that figure as "on topic", not "a perfect match".

All twelve briefs have been run while the reader was being worked on, so none is held out.
Start the app first (npm run dev), then:
    python3 scripts/eval_briefs.py --url http://localhost:3210
"""
import argparse
import json
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES = json.loads((HERE / "eval_briefs.json").read_text())
CREATORS = {c["id"]: c for c in json.loads((HERE.parent / "data" / "creators.json").read_text())}
FILTERS = ("niches", "locations", "stages", "genders", "minAge", "maxAge", "minFollowers", "maxFollowers", "maxRate", "minEngagement", "minAudienceUS")
LISTS = ("niches", "locations", "stages", "genders")


def call(url: str, brief: str) -> dict:
    req = urllib.request.Request(f"{url}/api/search", data=json.dumps({"query": brief}).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def reading(expect: dict, parsed: dict) -> dict[str, bool]:
    f = expect["filters"]
    got = dict(parsed, locations=[l["value"] for l in parsed["locations"]])
    out = {}
    for key in FILTERS:
        want, have = f.get(key, [] if key in LISTS else None), got.get(key)
        if isinstance(want, list):
            # Asking for both genders is the same as asking for neither.
            if key == "genders" and sorted(have) == ["man", "woman"]:
                have = []
            out[key] = sorted(want) == sorted(have)
        else:
            out[key] = want == have
    out["topic"] = any(t in parsed["semantic"].lower() for t in expect["topic_any"])
    return out


def fits(c: dict, expect: dict) -> bool:
    """The creator meets the requirements a careful reader would take from the brief."""
    f = expect["filters"]
    return not (
        (f.get("niches") and not set(f["niches"]) & set(c["niches"]))
        or (f.get("locations") and not any(v in (c["city"], c["region"], c["country"]) for v in f["locations"]))
        or (f.get("stages") and c["stage"] not in f["stages"])
        or (f.get("genders") and c["gender"] not in f["genders"])
        or (f.get("minAge") and c["age"] < f["minAge"]) or (f.get("maxAge") and c["age"] > f["maxAge"])
        or (f.get("minFollowers") and c["followers"] < f["minFollowers"]) or (f.get("maxFollowers") and c["followers"] > f["maxFollowers"])
        or (f.get("maxRate") and c["rate"] is not None and c["rate"] > f["maxRate"])
        or (f.get("minEngagement") and c["engagement"] < f["minEngagement"])
        or (f.get("minAudienceUS") and c["audience"]["us"] < f["minAudienceUS"])
    )


def posts_about(c: dict, expect: dict) -> bool:
    caps = " ".join(c["captions"]).lower()
    return any(t in caps for t in expect["topic_any"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000")
    args = ap.parse_args()

    read_ok = read_of = clean = all_fit = 0
    on_topic: list[float] = []
    for case in CASES:
        out = call(args.url, case["brief"])
        expect = case["expect"]
        read = reading(expect, out["parsed"])
        shown = [CREATORS[r["creator"]["id"]] for r in out["results"] + out["offRoster"]]
        misfits = [c["name"] for c in shown if not fits(c, expect)]
        first = shown[:5]
        about = sum(posts_about(c, expect) for c in first)
        if first:
            on_topic.append(about / len(first))
        bad = [k for k, ok in read.items() if not ok]
        read_ok += sum(read.values())
        read_of += len(read)
        clean += not bad
        all_fit += not misfits
        print(f"{case['id']:22} read {sum(read.values())}/{len(read)}  shown {len(out['results'])} on the roster, {len(out['offRoster'])} not yet"
              f"  fit {'all' if not misfits else 'NOT ALL'}  first five on topic {about}/{len(first)}  [{out['parser']}/{out['ranker']}, {out['tookMs']} ms]")
        if bad:
            got = dict(out["parsed"], locations=[l["value"] for l in out["parsed"]["locations"]])
            print(f"{'':22} misread: {', '.join(bad)}   got: {json.dumps({k: v for k, v in got.items() if v not in ([], None, '')})}")
        if misfits:
            print(f"{'':22} shown but do not meet the brief: {', '.join(misfits)}")

    n = len(CASES)
    print()
    print(f"fields read {read_ok}/{read_of}; briefs read with no mistake {clean}/{n}; briefs where everyone shown meets the brief {all_fit}/{n}; "
          + (f"first five on topic, mean over {len(on_topic)} briefs that showed anyone: {sum(on_topic) / len(on_topic):.2f}" if on_topic else "nobody shown for any brief"))


if __name__ == "__main__":
    main()
