"""Point each creator at the media files in public/creators/<id>/.

Photos are 1.jpg, 2.jpg and so on (five for most creators) and an optional
clip.mp4. The photos are listed newest post first. A clip was made from one of
the photos, so it takes that photo's place instead of appearing beside it. They are AI-generated
stand-ins made for this demo; nobody in them is a real person. Run this after
`npm run seed`, which resets `images`.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "creators.json"
MEDIA = ROOT / "public" / "creators"
PLANS = ROOT / "data" / "media_prompts.json"

# The four pilot sets were made before scripts/media_prompts.py existed, with
# prompts written by hand. This is which post each of their photos shows.
PILOT_POSTS = {"c095": [2, 3, 1, 0, 4], "c116": [0, 2, 4, 1, 5], "c081": [2, 0, 3, 4, 1], "c102": [5, 1, 4, 0, 5]}

# Every clip was animated from the creator's first photo, except this one.
CLIP_PHOTO = {"c117": 5}


def main() -> None:
    creators = json.loads(DATA.read_text())
    plans = {p["id"]: p["posts"] for p in json.loads(PLANS.read_text())} if PLANS.exists() else {}
    plans.update(PILOT_POSTS)
    with_photos = with_clips = 0
    for c in creators:
        folder = MEDIA / c["id"]
        numbers = sorted(int(p.stem) for p in folder.glob("*.jpg") if p.stem.isdigit()) if folder.is_dir() else []
        for key in ("photoCredit", "video", "videoAt"):
            c.pop(key, None)
        # Which caption each photo illustrates, so quick look can show the post beside it.
        # Photos past the fifth belong to the extra posts in scripts/seed.py, in order.
        plan = plans.get(c["id"], [])
        post_of = {n: plan[n - 1] if n <= len(plan) else n for n in numbers}
        numbers = [n for n in numbers if post_of[n] < len(c["captions"])]
        numbers.sort(key=lambda n: (c["postDays"][post_of[n]], n))
        c["images"] = [f"/creators/{c['id']}/{n}.jpg" for n in numbers]
        c["photoPosts"] = [post_of[n] for n in numbers]
        if numbers:
            with_photos += 1
        if numbers and (folder / "clip.mp4").exists():
            c["video"] = f"/creators/{c['id']}/clip.mp4"
            c["videoAt"] = numbers.index(CLIP_PHOTO.get(c["id"], 1))
            with_clips += 1
    DATA.write_text(json.dumps(creators, indent=1, ensure_ascii=False) + "\n")
    print(f"{with_photos} of {len(creators)} creators have photos, {with_clips} have a clip")


if __name__ == "__main__":
    main()
