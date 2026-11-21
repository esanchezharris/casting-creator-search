import sys, json
import judge as J  # run from scripts/experiments
E = J.E
model = sys.argv[1]
for case in E.CASES:
    if not ("relevant_if_caption_has" in case or "relevant_if_note_has" in case): continue
    p = J.parsed_for(case["query"], "llm")
    m, _ = J.judge(model, p["semantic"])
    terms = case.get("relevant_if_caption_has", []) + case.get("relevant_if_note_has", [])
    extra = sorted(t for t in m if not any(x in t.lower() for x in terms))
    labelled = {t for t in J.TEXTS if any(x in t.lower() for x in terms)}
    missed = sorted(labelled - m)
    if extra or missed:
        print(f"\n{case['query']}  [topic: {p['semantic']}]  terms={terms}")
        for t in extra: print("   + judge only:", t)
        for t in missed: print("   - label only:", t)
