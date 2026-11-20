# Eval

`scripts/eval.py` sends every query in `scripts/eval_queries.json` to the running
app and scores what comes back. The full output of the latest run is in
[eval-run-rules-keywords.txt](eval-run-rules-keywords.txt). Every number below
comes from a run on 20 Nov 2026 against the seed-11 dataset (120 fictional
creators: 72 roster, 30 applicants, 18 prospects).

## What is measured

- **Filters**: did the parser extract exactly the expected niches, places,
  stages, follower range, engagement and US-audience floor? All or nothing per query.
- **P@5**: of the first five creators shown, the share with a post (or CRM
  note) on the topic.
- **Recall**: of the creators in the data file who pass the expected filters
  and have a relevant post, the share that came back. Ground truth is computed
  in the script from `data/creators.json`, not from the API, and follows the
  roster-first rule (applicants and prospects are expected only when fewer
  than five roster creators qualify).
- **Nobody fits**: for queries where the data holds no one who qualifies, did
  the search return no one?

## Results

Only one mode could be run. There is no `OPENAI_API_KEY` in `.env.local`, so
the LLM parser and the embedding ranker have still never been executed.

| Step | Parser + ranker | Cases | Filters | P@5 | Recall | Nobody fits |
| --- | --- | --- | --- | --- | --- | --- |
| 1. After the pipeline model (Phase 0) | rules + keywords | 21 | 19/21 | 0.98 (12 queries) | 0.90 | 1/1 |
| 2. Hard cases added, no fixes yet | rules + keywords | 46 | 35/46 | 0.78 (24 queries) | 0.73 | 4/4 |
| 3. Parser fixes | rules + keywords | 46 | 46/46 | 0.83 | 0.79 | 4/4 |
| 4. Keyword relevance cutoff at 0.5 | rules + keywords | 46 | 46/46 | 0.88 | 0.78 | 4/4 |
| 5. Held-out cases, written after the fixes | rules + keywords | 10 | 7/10 | 0.90 (5 queries) | 0.80 | 0/1 |
| LLM parser | llm + keywords | not run | | | | |
| LLM parser, embedding ranker | llm + embeddings | not run | | | | |

Rows 1 to 4 are the same code path at four points in time, so they show what
each change did. Row 4 is the current state on the 46 cases the fixes were
developed against. Row 5 is the honest one: ten queries written afterwards and
never tuned on. Read 46/46 as "the regression set passes", not as accuracy.

## What each step fixed

**Step 2 to 3, parser.** Three rule changes took filters from 35/46 to 46/46.
A niche word is now read as a creator type only when the words around it say
so ("fitness creators", "skincare in New York", "runners"), and as a topic
otherwise ("running shoes", "hair ties for the gym", "before lifting"). Number
words and odd phrasings are rewritten to digits before the range rules run ("a
quarter million plus", "between fifty and a hundred thousand", "no more than
30,000"). Misspelled niches, places and topic words are matched to the nearest
known word within one edit, two for long words ("fitnes creaters in Flordia",
"sunscrean").

**Step 3 to 4, ranking.** Keyword ranking used to return anyone who matched a
single word. Those weak matches counted as roster matches, pushed the roster
past five and hid the applicants who actually fit. Dropping results under half
the best score raised P@5 from 0.83 to 0.88 for one point of recall. The
threshold was picked by running the eval at 0, 0.3, 0.4, 0.5 and 0.6; at 0.6
recall fell to 0.60.

## What still fails

Paraphrases, which is the gap the embedding ranker exists to close and which
could not be tested here:

| Query | P@5 | Recall |
| --- | --- | --- |
| getting better rest at night | 0.00 | 0.00 |
| stuff that keeps your face from burning at the beach | 0.00 | 0.22 |
| hair ties for the gym | 0.40 | 0.80 |
| something to drink before lifting | 1.00 | 0.24 |
| who talks about caffeine before the gym | 0.80 | 0.24 |
| footwear for long distance | 0.80 | 0.62 |

"Getting better rest at night" returns five creators and none of them posted
about sleep: the only shared word is "night". Keyword search cannot know that
rest means sleep.

Held-out parser misses, left unfixed on purpose:

- "yoga teachers with over 80k followers": "yoga" is followed by a noun that
  is not in the creator-word list, so it is read as a topic, not as wellness.
- "roster talent in Texas with 60% or more of their audience in the US": the
  audience rule fires but misses the number and falls back to 50.
- "top beauty and haircare creators, half a million and up": "and up" is not a
  known way to say "or more", so 500000 ends up in the topic text.
- "makeup tutorials from creators in Chicago": nobody in Chicago posts about
  makeup, but one creator is returned for the word "tutorial".

Other limits worth knowing:

- Captions come from about 80 templates, so many creators share identical
  posts. Scores on real captions would be lower and noisier.
- Relevance is a substring check against a hand-written term list per query.
  It is cheap and repeatable but it is my judgment, not a second rater's.
- 29 topic queries is a small sample. A single query moves mean P@5 by 0.03.

## Run it

    npm run dev                      # or: npx next dev --port 3210
    npm run eval -- --url http://localhost:3210

To compare modes once a key is set, restart the app with `PARSER=rules` and/or
`RANKER=keywords` and rerun. The script prints which parser and ranker
actually answered.
