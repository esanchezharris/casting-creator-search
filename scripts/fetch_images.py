"""Give creators real photos from Unsplash.

    UNSPLASH_ACCESS_KEY=... python3 scripts/fetch_images.py
    UNSPLASH_ACCESS_KEY=... python3 scripts/fetch_images.py --pages 4   # an hour later, to add more

One portrait search per (niche, presentation) pair, e.g. "woman gym workout".
A creator's five photos should plausibly show one person, so a set has to pass
three checks, all read from what the API returns:

1. One photographer.
2. Uploaded within a day of each other (one shoot).
3. Every description names one person of the searched presentation ("a woman
   in ..."), with no groups, mannequins or product shots, and the five
   descriptions are alike (same clothes, same setting). Likeness is word
   overlap; sets under MIN_ALIKE are dropped.

The first version used check 1 alone. On the first real run that gave 25 sets,
and by eye about half mixed several people or included bottles and mannequins.
With all three checks the same data gives far fewer sets, but they hold up.
It is still a heuristic working from text: look through the grid afterwards.

So only some creators get photos. Fitness creators are served first (the demo
briefs are about fitness), then roster before applicants, then by recent
reach; a creator can borrow a set from a visually similar niche. Everyone else
keeps `images: []`, which the UI draws as placeholder frames, and the default
screen sorts creators with photos first. A demo-mode key allows 50 requests an
hour; responses are cached in data/unsplash_cache.json (gitignored), so a rerun
costs nothing and a later run with a higher --pages adds to what is there.

Following the Unsplash API guidelines (https://unsplash.com/documentation,
checked 20 Nov 2026):
- auth is the header `Authorization: Client-ID <access key>`
- search is GET /search/photos, at most 30 per page, orientation=portrait
- the image URLs the API returns are used directly (hotlinked), never copied;
  requests to images.unsplash.com do not count against the rate limit
- each creator stores the photographer's name and profile link, and the UI
  credits them and Unsplash wherever the photos show
- nothing here is "like a download", so the download endpoint is not called
"""
import argparse
import itertools
import re
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "unsplash_cache.json"
API = "https://api.unsplash.com"
UTM = "utm_source=casting_demo&utm_medium=referral"
PER_CREATOR = 5
PAGES = 2            # 10 niches x 2 presentations x 2 pages = 40 requests, under the 50/hour demo limit
MIN_ALIKE = 0.4      # mean word overlap between the five descriptions; see photo_sets()
KEEP_REQUESTS = 3    # stop before the hourly limit is fully spent

SUBJECT = {
    "fitness": "gym workout", "running": "runner running outdoors", "beauty": "makeup beauty",
    "skincare": "skincare face", "hair": "hairstyle hair", "fashion": "fashion outfit",
    "streetwear": "streetwear street style", "lifestyle": "lifestyle at home", "wellness": "yoga pilates",
    "food": "cooking kitchen",
}
# The seed data's first names are fictional; this only keeps a photo set from clashing with a name.
# A creator with no set in their own niche may take one from a niche that looks the same on camera.
LOOKS_LIKE = [{"fitness", "wellness", "running"}, {"beauty", "skincare", "hair"}, {"fashion", "streetwear", "lifestyle"}]
STOP = set("a an the in on is are and of with her his at to for by from near while during front".split())
PERSON = {"woman": {"woman", "girl", "lady", "female"}, "man": {"man", "guy", "male", "boy"}}
NOT_ONE_PERSON = {"women", "men", "people", "group", "couple", "two", "three", "girls", "boys", "friends",
                  "mannequin", "mannequins"}
# Sets that passed the checks but failed a look at the grid. Reviewed by eye on 20 Nov 2026.
REJECTED_BY_EYE = {
    "nobleseed nobleseed": "five runners on one street in white, grey and red shirts: at least three people",
}
MASC = {"Marcus", "Theo", "Julian", "Kai", "Mateo", "Andre", "Leo", "Omar", "Felix", "Devon"}


def fetch(cache: dict, query: str, page: int) -> list[dict] | None:
    """One search page, from the cache if we have it. None means the rate limit is nearly spent."""
    key = f"{query}|{page}"
    if key in cache["pages"]:
        return cache["pages"][key]
    if cache.get("remaining", 50) <= KEEP_REQUESTS:
        return None
    qs = urllib.parse.urlencode({"query": query, "orientation": "portrait", "per_page": 30,
                                 "page": page, "content_filter": "high"})
    req = urllib.request.Request(f"{API}/search/photos?{qs}", headers={
        "Authorization": f"Client-ID {os.environ['UNSPLASH_ACCESS_KEY']}", "Accept-Version": "v1"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            cache["remaining"] = int(r.headers.get("X-Ratelimit-Remaining", 0))
            results = json.load(r)["results"]
    except urllib.error.HTTPError as e:
        print(f"  {query!r} page {page}: HTTP {e.code} {e.read()[:200]!r}")
        if e.code in (403, 429):
            cache["remaining"] = 0
        return None
    cache["pages"][key] = [slim(p) for p in results]
    CACHE.write_text(json.dumps(cache))
    return cache["pages"][key]


def slim(p: dict) -> dict:
    """Keep only what the app needs from a photo object."""
    return {"id": p["id"], "created_at": p["created_at"], "raw": p["urls"]["raw"],
            "alt": p.get("alt_description"), "user_id": p["user"]["id"], "user_name": p["user"]["name"],
            "user_url": p["user"]["links"]["html"]}


def fetch_user(cache: dict, user_url: str) -> list[dict] | None:
    """A photographer's latest portraits (GET /users/:username/photos), cached like searches."""
    username = user_url.rsplit("@", 1)[-1]
    key = f"user|{username}"
    if key in cache["pages"]:
        return cache["pages"][key]
    if cache.get("remaining", 50) <= KEEP_REQUESTS:
        return None
    qs = urllib.parse.urlencode({"orientation": "portrait", "per_page": 30, "order_by": "latest"})
    req = urllib.request.Request(f"{API}/users/{urllib.parse.quote(username)}/photos?{qs}", headers={
        "Authorization": f"Client-ID {os.environ['UNSPLASH_ACCESS_KEY']}", "Accept-Version": "v1"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            cache["remaining"] = int(r.headers.get("X-Ratelimit-Remaining", 0))
            got = [slim(x) for x in json.load(r)]
    except urllib.error.HTTPError as e:
        print(f"  @{username}: HTTP {e.code}")
        if e.code in (403, 429):
            cache["remaining"] = 0
        return None
    cache["pages"][key] = got
    CACHE.write_text(json.dumps(cache))
    return got


def when(p: dict) -> datetime:
    return datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))


def words(p: dict) -> set[str]:
    return set(re.findall(r"[a-z]+", (p.get("alt") or "").lower()))


def one_person(p: dict, presentation: str) -> bool:
    """The description names one person of the searched presentation and nobody else."""
    w = words(p)
    other = PERSON["man" if presentation == "woman" else "woman"]
    return bool(w & PERSON[presentation]) and not (w & other) and not (w & NOT_ONE_PERSON)


def alike(a: dict, b: dict) -> float:
    """Word overlap between two descriptions, ignoring filler and the person word itself."""
    skip = STOP | PERSON["woman"] | PERSON["man"]
    x, y = words(a) - skip, words(b) - skip
    return len(x & y) / len(x | y) if x | y else 0.0


def near_misses(photos: list[dict], presentation: str) -> list[list[dict]]:
    """Photographers with three or four usable search hits: worth one more request each."""
    by_user: dict[str, dict[str, dict]] = defaultdict(dict)
    for p in photos:
        if one_person(p, presentation):
            by_user[p["user_id"]][p["id"]] = p
    groups = [list(g.values()) for g in by_user.values() if 3 <= len(g) < PER_CREATOR]
    return sorted(groups, key=len, reverse=True)


def photo_sets(photos: list[dict], presentation: str) -> list[dict]:
    """Sets of five that pass the three checks in the module docstring, most alike first.

    MIN_ALIKE was set by printing every candidate set from the first run with its score next
    to its five descriptions: the eight sets at 0.43 and above each described one outfit in one
    place, and the two below (0.27, 0.06) were visibly different scenes.
    """
    by_user: dict[str, dict[str, dict]] = defaultdict(dict)
    for p in photos:
        if one_person(p, presentation):
            by_user[p["user_id"]][p["id"]] = p
    sets = []
    for group in by_user.values():
        ok = sorted(group.values(), key=when)
        best = None
        for i in range(len(ok)):
            shoot = [p for p in ok[i:] if (when(p) - when(ok[i])).total_seconds() <= 86400]
            if len(shoot) < PER_CREATOR:
                continue
            # Greedy: the most alike pair, then whichever photo is closest to those already chosen.
            chosen = list(max(itertools.combinations(shoot, 2), key=lambda ab: alike(*ab)))
            while len(chosen) < PER_CREATOR:
                rest = [p for p in shoot if p not in chosen]
                chosen.append(max(rest, key=lambda p: sum(alike(p, c) for c in chosen)))
            score = sum(alike(x, y) for x, y in itertools.combinations(chosen, 2)) / 10
            if best is None or score > best["alike"]:
                best = {"photos": chosen, "alike": round(score, 2)}
        if best and best["alike"] >= MIN_ALIKE:
            sets.append(best)
    return sorted(sets, key=lambda s: -s["alike"])


def image_url(raw: str) -> str:
    # Unsplash's own resizing parameters on the hotlinked URL: a 4:5 crop centred on the face.
    return f"{raw}&w=640&h=800&fit=crop&crop=faces&auto=format&q=70"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=PAGES, help="search pages per niche and presentation")
    args = ap.parse_args()

    path = ROOT / "data" / "creators.json"
    creators = json.loads(path.read_text())
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {"pages": {}}
    for c in creators:
        c["images"] = []
        c.pop("photoCredit", None)

    # 1. Collect usable sets per (niche, presentation).
    sets: dict[tuple[str, str], list[dict]] = {}
    seen_users: set[str] = set()
    for niche, subject in SUBJECT.items():  # fitness is first, so it gets any spare requests
        for presentation in ("woman", "man"):
            photos: list[dict] = []
            for page in range(1, args.pages + 1):
                got = fetch(cache, f"{presentation} {subject}", page)
                if got is None:
                    break
                photos += got
            # For photographers with three or four usable hits, look at their other portraits
            # and keep the ones uploaded within a day of a hit (the same shoot).
            for hits in near_misses(photos, presentation):
                more = fetch_user(cache, hits[0]["user_url"])
                if more:
                    photos += [p for p in more if any(abs((when(p) - when(h)).total_seconds()) <= 86400 for h in hits)]
            mine = [s for s in photo_sets(photos, presentation)
                    if s["photos"][0]["user_id"] not in seen_users and s["photos"][0]["user_name"] not in REJECTED_BY_EYE]
            seen_users.update(s["photos"][0]["user_id"] for s in mine)
            sets[(niche, presentation)] = mine
            print(f"{niche:10} {presentation:5} {len(photos):3} photos, {len(mine)} usable sets")

    # 2. Hand them out: fitness first, roster first, then recent reach.
    order = sorted(creators, key=lambda c: (c["niches"][0] != "fitness", c["stage"] != "roster", -c["recentReach"]))
    given = 0
    for c in order:
        niche = c["niches"][0]
        presentation = "man" if c["name"].split()[0] in MASC else "woman"
        similar = next((g for g in LOOKS_LIKE if niche in g), {niche})
        pool = sets[(niche, presentation)] or next((sets[(n, presentation)] for n in sorted(similar) if sets[(n, presentation)]), [])
        if not pool:
            continue
        s = pool.pop(0)
        first = s["photos"][0]
        c["images"] = [image_url(p["raw"]) for p in s["photos"]]
        c["photoCredit"] = {"name": first["user_name"], "url": f"{first['user_url']}?{UTM}"}
        given += 1
        print(f"  {c['name']:20} {niche:10} <- {first['user_name']} (alike {s['alike']})")

    CACHE.write_text(json.dumps(cache))
    path.write_text(json.dumps(creators, indent=2))
    print(f"\n{given} of {len(creators)} creators now have photos.")
    print(f"requests left this hour: {cache.get('remaining', 'unknown')}")


if __name__ == "__main__":
    main()
