"""Experiment: an LLM reads the distinct posts and notes and says which are about the topic."""
import json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import eval as E

CS = E.CREATORS
def notes_of(c): return [n["text"] for n in c["notes"] if n["kind"] in ("reliability", "terms")]
TEXTS = sorted({t for c in CS for t in c["captions"]}) + sorted({t for c in CS for t in notes_of(c)})
IDX = {t: i for i, t in enumerate(TEXTS)}
SYSTEM = """You match a topic from a brand's casting brief against creators' posts and CRM notes.
You get the topic and a numbered list of texts. Return the numbers of every text that is about the topic: a person reading the text would agree it shows the creator posts about, or does, what the topic asks for, even when the words differ ("rest" and "sleep").
A text that only shares a word with the topic, or is only in the same broad category, does not match.
If no text matches, return an empty list. Reply with JSON only: {"match":[numbers]}"""

def post(url, headers, body, timeout=60):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {e.read()[:300]}")

def judge(model, topic):
    user = f"Topic: {topic}\n\nTexts:\n" + "\n".join(f"{i}. {t}" for i, t in enumerate(TEXTS))
    t0 = time.time()
    if model.startswith("claude"):
        out = post("https://api.anthropic.com/v1/messages", {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01"},
                   {"model": model, "max_tokens": 600, "system": SYSTEM, "messages": [{"role": "user", "content": user}]})
        txt = out["content"][0]["text"]
    else:
        body = {"model": model, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]}
        if model.startswith("gpt-4"): body["temperature"] = 0
        else: body["reasoning_effort"] = os.environ.get("EFFORT", "low")
        out = post("https://api.openai.com/v1/chat/completions", {"authorization": "Bearer " + os.environ["OPENAI_API_KEY"]}, body)
        txt = out["choices"][0]["message"]["content"]
    txt = txt[txt.index("{"): txt.rindex("}") + 1]
    return {TEXTS[i] for i in json.loads(txt)["match"] if 0 <= i < len(TEXTS)}, time.time() - t0

def parsed_for(q, parser):
    body = {"query": q, "ranker": "keywords"}
    if parser == "rules": body["parser"] = "rules"
    return post("http://localhost:3210/api/search", {}, body)["parsed"]

def passes(c, p):
    if p["niches"] and not set(p["niches"]) & set(c["niches"]): return False
    if p["locations"] and not any(c[l["field"]] == l["value"] for l in p["locations"]): return False
    if p["genders"] and c["gender"] not in p["genders"]: return False
    if p["minAge"] and c["age"] < p["minAge"]: return False
    if p["maxAge"] and c["age"] > p["maxAge"]: return False
    if p["minFollowers"] and c["followers"] < p["minFollowers"]: return False
    if p["maxFollowers"] and c["followers"] > p["maxFollowers"]: return False
    if p["maxRate"] and c["rate"] is not None and c["rate"] > p["maxRate"]: return False
    if p["minEngagement"] and c["engagement"] < p["minEngagement"]: return False
    if p["minAudienceUS"] and c["audience"]["us"] < p["minAudienceUS"]: return False
    return True

def run(model, parser, verbose):
    cases = [c for c in E.CASES if "relevant_if_caption_has" in c or "relevant_if_note_has" in c or c.get("expect_empty")]
    def one(case):
        p = parsed_for(case["query"], parser)
        if not p["semantic"].strip(): return case, None, 0, p
        m, dt = judge(model, p["semantic"])
        pool = [c for c in CS if passes(c, p)]
        if p["stages"]: pool = [c for c in pool if c["stage"] in p["stages"]]
        hit = []
        for c in pool:
            n = sum(t in m for t in c["captions"]) + 0.5 * sum(t in m for t in notes_of(c))
            if n: hit.append((n, c))
        hit.sort(key=lambda x: (-x[0], -x[1]["recentReach"]))
        hit = [c for _, c in hit]
        if not p["stages"]:
            roster = [c for c in hit if c["stage"] == "roster"]
            hit = roster + ([c for c in hit if c["stage"] != "roster"] if len(roster) < 5 else [])
        return case, hit, dt, p
    with ThreadPoolExecutor(8) as ex: rows = list(ex.map(one, cases))
    agg = {"tuned": [[], [], [], []], "held": [[], [], [], []]}
    for case, shown, dt, p in rows:
        truth = set() if case.get("expect_empty") else E.ground_truth(case); a = agg["held" if case.get("held_out") else "tuned"]
        if shown is None: shown = []
        a[3].append(dt)
        if not truth:
            a[2].append(not shown); note = f"nobody fits, {len(shown)} returned"
        else:
            top = shown[:5]; pr = sum(E.relevant(c, case) for c in top) / len(top) if top else 0.0
            rc = len(truth & {c["id"] for c in shown}) / len(truth)
            a[0].append(pr); a[1].append(rc); note = f"{pr:.2f} {rc:.2f} {len(truth)}e {len(shown)}r"
        if verbose: print(f"  {note:28} {case['query'][:70]}  [{p['semantic']}]")
    for k, a in agg.items():
        m = lambda x: sum(x) / len(x) if x else float("nan")
        print(f"{model:22} {parser:5} {k:5} P@5 {m(a[0]):.2f} recall {m(a[1]):.2f} nobody {sum(a[2])}/{len(a[2])} median {sorted(a[3])[len(a[3])//2]:.1f}s max {max(a[3]):.1f}s")

if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "rules", "-v" in sys.argv)
