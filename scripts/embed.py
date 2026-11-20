"""Embed every creator profile and post into data/embeddings.json.

Run once after seeding (and again whenever creators.json changes):
    OPENAI_API_KEY=... python3 scripts/embed.py

The app picks the file up on restart and switches from keyword ranking to
ranking by meaning. Works with any OpenAI-compatible /embeddings endpoint.
"""
import json
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL = os.environ.get("EMBED_MODEL", "text-embedding-3-small")
DIMS = int(os.environ.get("EMBED_DIMS", "256")) or None  # 0 = model default


def embed(texts: list[str]) -> list[list[float]]:
    body = {"model": MODEL, "input": texts}
    if DIMS:
        body["dimensions"] = DIMS
    req = urllib.request.Request(
        f"{BASE}/embeddings", data=json.dumps(body).encode(),
        headers={"content-type": "application/json", "authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)["data"]
    return [d["embedding"] for d in sorted(data, key=lambda d: d["index"])]


def main() -> None:
    creators = json.loads((ROOT / "data" / "creators.json").read_text())
    texts, owners = [], []
    for c in creators:
        texts.append(f"{c['bio']} Niches: {', '.join(c['niches'])}. " + " ".join(c["captions"])
                     + " Notes: " + " ".join(n["text"] for n in c["notes"]))
        owners.append((c["id"], "doc"))
        for cap in c["captions"]:
            texts.append(cap)
            owners.append((c["id"], "caption"))

    vectors = []
    for i in range(0, len(texts), 200):
        vectors += embed(texts[i:i + 200])
        print(f"embedded {min(i + 200, len(texts))}/{len(texts)}")

    items: dict = {}
    for (cid, kind), vec in zip(owners, vectors):
        entry = items.setdefault(cid, {"doc": None, "captions": []})
        vec = [round(x, 5) for x in vec]
        if kind == "doc":
            entry["doc"] = vec
        else:
            entry["captions"].append(vec)

    out = ROOT / "data" / "embeddings.json"
    out.write_text(json.dumps({"model": MODEL, "dims": DIMS, "items": items}))
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
