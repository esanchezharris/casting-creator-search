# Prompt for Claude Code

Paste everything below the line into Claude Code, started in this folder.

---

Read CLAUDE.md and README.md first, then look at
docs/reference/questionnaire.png. Then finish this project in one pass,
working through the phases in order. Run `npm install` if node_modules is
missing. After each phase run `npm run build` and fix anything it reports
before moving on. Commit after each phase with a short message (run `git init`
first if this is not a repo yet).

Check `.env.local` for OPENAI_API_KEY and PEXELS_API_KEY before you start.
Phases marked [key] need one. If the key is missing, skip that phase, keep
going, and list it in your final report. Do not mock or fake its output.

## Phase 0: model how the agency actually works
Read "How the agency works" in CLAUDE.md first. The current data treats every creator
as the same kind of record and ranks on follower count and city. Change that
before anything else, because later phases build on it.

1. Data (scripts/seed.py, src/lib/types.ts). Add to each creator:
   - `stage`: "roster" (about 60%), "applicant" (25%), "prospect" (15%).
   - `partner`: a first name from a short fictional list, roster only.
   - `audience`: share of followers in the US (0 to 100) and the top market.
     Make it vary independently of where the creator lives.
   - `recentReach`: average views on recent reels. Replace `avgViews`.
   - `campaigns`: completed campaigns count, roster only.
   - `notes`: one or two short CRM notes from templates, covering
     reliability ("delivered two days early"), terms ("declines gifting-only
     offers", "open to 30-day paid usage") and conflicts ("exclusive with an
     energy drink brand until March").
   - `rate` only for roster creators. Applicants and prospects have no agreed
     rate; show "No rate yet".
2. Search. Add `stages` and `minAudienceUS` to ParsedQuery, the rule parser,
   the LLM prompt and `sanitize()`. "US audience", "mostly American
   followers", "signed", "applicants", "not signed yet" should all parse.
   "In Florida" stays creator location; audience is a separate filter. Notes
   are searchable text and can be quoted as the match reason.
3. Roster first. A search with no stage filter returns roster creators. If
   fewer than five match, add a second group under its own heading, "Not on
   the roster yet", with the applicants and prospects who fit. This is the
   point of the demo's second half: the tool shows who is worth signing for
   this brief.
4. Cards. Show a stage badge and the talent partner. Stats become recent
   reach, engagement, US audience and rate. Add "Recent reach" to the sort
   options. If a note mentions a conflict relevant to the query topic, show it
   on the card as a plain warning line.
5. Shortlist. "Copy shortlist" produces text a talent partner could paste to a
   brand: one line per creator with name, handle, reach, US audience and
   price, then a total. Applicants and prospects are listed separately as
   "would need signing".
6. Update the eval cases for the new fields and rerun. Record the new
   baseline; the old one (13/15, P@5 0.91) no longer applies.

## Phase 1: make the LLM paths work [key: OPENAI_API_KEY]
1. Run `npm run embed` (after Phase 0 has reseeded). Include notes in the
   embedded text. Fix whatever breaks. Confirm data/embeddings.json has an
   entry for all 120 creators.
2. Start the dev server and send a few queries to /api/search. Confirm the
   response says `parser: "llm"` and `ranker: "embeddings"`. Fix
   `parseWithLLM` and `rankByEmbeddings` as needed. If a default model name is
   rejected, look up the provider's current small chat and embedding models
   and update `.env.example` and the code defaults.
3. Embedding ranking currently returns every creator that passes the filters.
   Add a relevance cutoff so weak matches drop out. Pick the threshold by
   looking at score distributions on the eval queries, and leave a comment
   saying how you chose it.

## Phase 2: prove it with the eval
1. Grow scripts/eval_queries.json from 15 to at least 30 cases. Add the hard
   kinds: paraphrases that share no keywords with any post ("something to
   drink before lifting"), topic words that look like niches ("running
   shoes", "hair ties for the gym"), ranges written oddly ("a quarter million
   plus"), two places, misspellings, and three queries that should return
   nothing. Read data/creators.json so the expected answers are right.
2. Add recall to scripts/eval.py alongside P@5: of the creators in the whole
   dataset that pass the expected filters and have a relevant post, what share
   show up in the results. Compute the ground truth in the script from
   data/creators.json, not from the API.
3. Run the eval in each mode the keys allow: rules+keywords (set PARSER=rules
   RANKER=keywords), llm+keywords, llm+embeddings. Write docs/EVAL.md with one
   table of real results and three or four sentences on what each step fixed
   and what still fails. Failures are fine and should be listed plainly.
4. Fix the cheap failures you find, rerun, and update the table.

## Phase 3: photos [key: PEXELS_API_KEY]
Run scripts/fetch_images.py and fix it against the real API. Then open the
grid and check the result: every creator should have 5 portrait photos that
plausibly show one person. Where the photographer grouping fails, improve the
heuristic or reassign. Report how many profiles still look mixed.

## Phase 4: UI features
Follow the design rules in CLAUDE.md exactly. Build these, in this order, and
stop adding once they work well:
1. Quick look. Pressing Space on the focused card (or clicking the name) opens
   a side panel with the larger photo set, bio, all six recent posts with the
   matching one marked, and the stats. Esc closes it; arrow keys still move
   between creators while it is open.
2. Editable chips. Clicking a follower or engagement chip opens a small
   popover to change the numbers. An "Add filter" control lets the user add a
   niche or place without retyping the query. Both re-run the search through
   `POST {filters}`.
3. States. A visible loading state while a search is in flight (the LLM path
   takes a second or two), and skeleton cards on first load. Never flash the
   empty state while loading.
4. Scrub polish. Preload a card's remaining photos when it is one row from
   entering the viewport so the first sweep never shows a blank frame. Support
   touch drag. While a card has keyboard focus, `,` and `.` step through its
   photos.
5. Shortlist. Persist it in localStorage inside try/catch. Copying the
   shortlist should include the query it came from as a first line.
6. Mobile. At 390px wide nothing overlaps, the sort control scrolls
   horizontally instead of wrapping, and the tray is one compact row.

Check your work in a real browser at 1440px and 390px if you have a browser
tool, comparing against the reference image for spacing, weight and contrast.
If you do not, say so in the report.

## Phase 5: ship
1. Update README.md so setup, the eval numbers and the feature list match what
   now exists.
2. Write docs/DEMO.md: a shot-by-shot script for a 2-minute screen recording
   (about 280 spoken words). Suggested arc: the problem in one sentence, one
   brief typed live with the chips appearing, a sweep across three cards,
   keyboard shortlisting and copy, then a narrower brief where the roster is
   thin and the "Not on the roster yet" group appears, then 20 seconds on the
   eval table with one honest failure, then one line on what comes next
   (pgvector, real CRM data). Frame it around their promise of names and
   prices the same day a brief arrives. Use the real numbers from docs/EVAL.md.
3. Make sure `npm run build` passes and the app runs from a clean
   `npm install && npm run dev` with no keys set.

## Final report
End with: what you finished, what you skipped and why, the eval table, any
profiles with mismatched photos, and the three design decisions you are least
sure about so Emilio can review those first.
