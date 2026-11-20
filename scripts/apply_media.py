"""Point each creator at the media files in public/creators/<id>/.

Photos are 1.jpg to 5.jpg and an optional clip.mp4. They are AI-generated
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


def main() -> None:
    creators = json.loads(DATA.read_text())
    plans = {p["id"]: p["posts"] for p in json.loads(PLANS.read_text())} if PLANS.exists() else {}
    plans.update(PILOT_POSTS)
    with_photos = with_clips = 0
    for c in creators:
        folder = MEDIA / c["id"]
        photos = sorted(folder.glob("[0-9].jpg")) if folder.is_dir() else []
        c.pop("photoCredit", None)
        c.pop("video", None)
        c["images"] = [f"/creators/{c['id']}/{p.name}" for p in photos]
        # Which caption each photo illustrates, so quick look can show the post beside it.
        c["photoPosts"] = plans.get(c["id"], [])[:len(photos)] if photos else []
        if photos:
            with_photos += 1
        if (folder / "clip.mp4").exists():
            c["video"] = f"/creators/{c['id']}/clip.mp4"
            with_clips += 1
    DATA.write_text(json.dumps(creators, indent=1, ensure_ascii=False) + "\n")
    print(f"{with_photos} of {len(creators)} creators have photos, {with_clips} have a clip")


if __name__ == "__main__":
    main()
