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


def main() -> None:
    creators = json.loads(DATA.read_text())
    with_photos = with_clips = 0
    for c in creators:
        folder = MEDIA / c["id"]
        photos = sorted(folder.glob("[0-9].jpg")) if folder.is_dir() else []
        c.pop("photoCredit", None)
        c.pop("video", None)
        c["images"] = [f"/creators/{c['id']}/{p.name}" for p in photos]
        if photos:
            with_photos += 1
        if (folder / "clip.mp4").exists():
            c["video"] = f"/creators/{c['id']}/clip.mp4"
            with_clips += 1
    DATA.write_text(json.dumps(creators, indent=1, ensure_ascii=False) + "\n")
    print(f"{with_photos} of {len(creators)} creators have photos, {with_clips} have a clip")


if __name__ == "__main__":
    main()
