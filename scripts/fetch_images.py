"""Replace the placeholder photos in data/creators.json with Pexels photos.

    PEXELS_API_KEY=... python3 scripts/fetch_images.py

Free key: https://www.pexels.com/api/ . Photos are grouped by photographer,
because one photographer's set is usually one shoot with one model, which
makes five frames read as the same "creator". It is a heuristic: look through
the grid afterwards and re-run or hand-fix any profile that mixes people.

NOT TESTED against the live API (it was written offline). Check the first run.
"""
import json
import os
import random
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PER_CREATOR = 5
SEARCH = {
    "fitness": "gym workout portrait", "running": "runner portrait", "beauty": "makeup beauty portrait",
    "skincare": "skincare routine portrait", "hair": "hairstyle portrait", "fashion": "fashion editorial portrait",
    "streetwear": "streetwear fashion portrait", "lifestyle": "lifestyle portrait city",
    "wellness": "yoga pilates portrait", "food": "cooking kitchen portrait",
}


def pexels(query: str, page: int) -> list[dict]:
    qs = urllib.parse.urlencode({"query": query, "orientation": "portrait", "per_page": 80, "page": page})
    req = urllib.request.Request(f"https://api.pexels.com/v1/search?{qs}",
                                 headers={"Authorization": os.environ["PEXELS_API_KEY"]})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("photos", [])


def main() -> None:
    path = ROOT / "data" / "creators.json"
    creators = json.loads(path.read_text())
    rnd = random.Random(3)
    used: set[int] = set()

    for niche, query in SEARCH.items():
        mine = [c for c in creators if c["niches"][0] == niche]
        if not mine:
            continue
        photos = [p for page in (1, 2, 3) for p in pexels(query, page)]
        by_photographer: dict[int, list[dict]] = defaultdict(list)
        for p in photos:
            by_photographer[p["photographer_id"]].append(p)
        sets = [v for k, v in by_photographer.items() if len(v) >= PER_CREATOR and k not in used]
        rnd.shuffle(sets)
        loose = [p for p in photos]
        rnd.shuffle(loose)
        for c in mine:
            if sets:
                chosen = sets.pop()[:PER_CREATOR]
                used.add(chosen[0]["photographer_id"])
            else:
                chosen, loose = loose[:PER_CREATOR], loose[PER_CREATOR:]
            if len(chosen) == PER_CREATOR:
                c["images"] = [p["src"]["large"] for p in chosen]
        print(f"{niche}: {len(mine)} creators, {len(photos)} photos found")

    path.write_text(json.dumps(creators, indent=2))
    print("updated", path)


if __name__ == "__main__":
    main()
