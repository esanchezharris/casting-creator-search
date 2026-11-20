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
| 4. Ranking fixes (current) | rules + keywords | 46 | 46/46 | 0.88 | 0.77 | 4/4 |
| 5. Held-out cases (current) | rules + keywords | 10 | 7/10 | 0.80 (5 queries) | 0.80 | 0/1 |
| All 56 cases (current) | rules + keywords | 56 | 53/56 | 0.86 (29 queries) | 0.77 | 4/5 |
| LLM parser | llm + keywords | not run | | | | |
| LLM parser, embedding ranker | llm + embeddings | not run | | | | |

Rows 1 to 4 are the same code path at four points in time, so they show what
each change did. Row 4 is the current state on the 46 cases the fixes were
developed against: read 46/46 as "the regression set passes", not as accuracy.
Row 5 is ten queries written after the parser fixes and never used to tune the
parser. It is the more honest number, with one caveat spelled out below.

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

**Step 3 to 4, ranking.** Three changes. Keyword ranking used to return anyone
who matched a single word; those weak matches counted as roster matches,
pushed the roster past five and hid the applicants who actually fit. Results
under half the best score are now dropped. The threshold was picked by running
the eval at 0, 0.3, 0.4, 0.5 and 0.6: P@5 rose from 0.83 to 0.88 up to 0.5 with
recall about flat, and at 0.6 recall fell to 0.65. Second, conflict notes no
longer count toward the score. "Exclusive with an energy drink brand" was
making a creator the top match for an energy drink brief, which is backwards;
it now produces a warning on the card and halves the score. Third, a stage
filter is applied before the cutoff instead of after.

**The held-out caveat.** The held-out set first scored P@5 0.90, recall 0.80.
Taking conflict notes out of the score dropped it to 0.70 and 0.70, because
"prospects who review protein powder" started returning nobody: the cutoff was
being measured against a roster creator the query had excluded. That was a
real bug and fixing it (the third change above) brought the set to 0.80 and
0.80. So one ranking fix was prompted by a held-out query. No parser rule was
changed for the held-out set, and its three parser misses are still misses.

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

Partial misses: "fitness creators who post about running"
finds 3 of 6 (posts say "long run" and "tempo run", the query says "running",
and the stemmer does not connect them), and the held-out "anyone under 20k who posts thrift hauls" returns
two creators of whom only one mentions thrifting.

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
