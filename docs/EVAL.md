# Eval

`scripts/eval.py` sends every query in `scripts/eval_queries.json` to the running
app and scores what comes back. Every number here comes from a run on 20 Nov
2026 against the seed-11 dataset (120 fictional creators: 72 roster, 30
applicants, 18 prospects). The full output of the final run in each mode is in
[eval-runs/](eval-runs/).

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

56 queries: 46 that the fixes below were developed against ("tuned"), and 10
written after the parser fixes and kept apart ("held out"). 29 of the 56 have a
topic, so P@5 and recall are means over 24 tuned and 5 held-out queries.

## Results, final code, all four modes

| Parser + ranker | Set | Filters | P@5 | Recall | Nobody fits |
| --- | --- | --- | --- | --- | --- |
| rules + keywords | tuned | 46/46 | 0.88 | 0.77 | 4/4 |
| rules + keywords | held out | 7/10 | 0.80 | 0.80 | 1/1 |
| LLM + keywords | tuned | 45/46 | 0.81 | 0.71 | 4/4 |
| LLM + keywords | held out | 7/10 | 0.80 | 0.80 | 1/1 |
| rules + embeddings | tuned | 46/46 | 0.84 | 0.79 | 2/4 |
| rules + embeddings | held out | 7/10 | 0.59 | 0.89 | 0/1 |
| LLM + embeddings (the default with a key) | tuned | 45/46 | 0.83 | 0.75 | 2/4 |
| LLM + embeddings (the default with a key) | held out | 7/10 | 0.63 | 1.00 | 1/1 |

Models: `gpt-4o-mini` for parsing at temperature 0, `text-embedding-3-small` at
256 dimensions. LLM runs are not perfectly repeatable even at temperature 0:
two runs of the same build of LLM + keywords gave 46/46 filters with P@5 0.85,
then 45/46 with P@5 0.81. The table shows the later run.

**The plain reading: on this dataset the cheap baseline wins on average.**
Rules + keywords has the best precision and is the only mode that reliably says
"nobody fits". The language-model parts earn their place on one kind of query,
paraphrase, and lose a little everywhere else:

| Query | rules + keywords | LLM + embeddings |
| --- | --- | --- |
| getting better rest at night | P@5 0.00, recall 0.00 | P@5 1.00, recall 1.00 |
| stuff that keeps your face from burning at the beach | 0.00, 0.22 | 1.00, 1.00 |
| footwear for long distance | 0.80, 0.62 | 1.00, 1.00 |
| something to drink before lifting | 1.00, 0.24 | 1.00, 0.29 |
| hair ties for the gym | 0.40, 0.80 | 0.20, 0.20 |
| Runners who review shoes | 1.00, 1.00 | 0.50, 0.00 |
| creators who post about cryptocurrency trading (nobody fits) | returns nobody | returns 8 creators |

## How the numbers got here

The same 46 tuned queries, rule parser and keyword ranking, at each step:

| Step | Cases | Filters | P@5 | Recall | Nobody fits |
| --- | --- | --- | --- | --- | --- |
| 1. After the pipeline model (Phase 0) | 21 | 19/21 | 0.98 (12 queries) | 0.90 | 1/1 |
| 2. Hard cases added, no fixes yet | 46 | 35/46 | 0.78 (24 queries) | 0.73 | 4/4 |
| 3. Parser fixes | 46 | 46/46 | 0.83 | 0.79 | 4/4 |
| 4. Ranking fixes (final) | 46 | 46/46 | 0.88 | 0.77 | 4/4 |

Read 46/46 as "the regression set passes", not as accuracy. The held-out 7/10
is the honest figure for the parser.

**Step 2 to 3, rule parser.** A niche word is read as a creator type only when
the words around it say so ("fitness creators", "skincare in New York",
"runners"), and as a topic otherwise ("running shoes", "hair ties for the gym",
"before lifting"). Number words and odd phrasings are rewritten to digits before
the range rules run ("a quarter million plus", "between fifty and a hundred
thousand", "no more than 30,000"). Misspelled niches, places and topic words are
matched to the nearest known word within one edit, two for long words ("fitnes
creaters in Flordia", "sunscrean").

**Step 3 to 4, keyword ranking.** Keyword ranking used to return anyone who
matched a single word; those weak matches counted as roster matches, pushed
the roster past five and hid the applicants who actually fit. Results under
half the best score are now dropped (chosen by running the eval at 0, 0.3, 0.4,
0.5 and 0.6: P@5 rose from 0.83 to 0.88 up to 0.5, and at 0.6 recall fell to
0.65). Conflict notes and pipeline-status notes no longer count toward the
score: "exclusive with an energy drink brand" was making a creator the top
match for an energy drink brief, which is backwards. It now produces a warning
on the card and halves the score. A stage filter is applied before the cutoff
instead of after.

**The held-out caveat.** One ranking bug was found through a held-out query.
With conflict notes out of the score, "prospects who review protein powder"
returned nobody, because the cutoff was being measured against a roster
creator the query had excluded. That fix is the stage-before-cutoff change
above. No parser rule was changed for the held-out set.

**LLM parser, first run to final.** It had never been run. Unmodified, it
scored 41/46 filters, P@5 0.80 and recall 0.63 on the tuned set with keyword
ranking. Three things were wrong and all three are fixed in code, not by hoping:

- It invented a niche from the topic ("something to drink before lifting"
  became fitness) and invented follower limits nobody asked for. The prompt now
  carries three complete worked examples.
- After a prompt change it sometimes returned filters and dropped the topic, so
  the search silently ran on filters alone. If the model returns no topic and
  the rule parser finds one in the same sentence, the rule parser's is used.
- It misread numbers: "50K+" came back as 500,000, and so did "a quarter
  million plus". Whenever the rule parser reads a figure out of the sentence,
  that figure replaces the model's, and the replacement is logged.

**Embedding ranker, first run to final.** `scripts/embed.py` ran clean on the
first try. The ranker worked but returned every creator who passed the filters,
so the roster always looked full. The cutoff (drop anything under 0.8 of the
best score) was chosen on the tuned set with the rule parser:

| Cutoff | 0 | 0.7 | 0.8 | 0.85 | 0.9 |
| --- | --- | --- | --- | --- | --- |
| P@5 | 0.72 | 0.81 | 0.84 | 0.88 | 0.93 |
| Recall | 0.86 | 0.89 | 0.79 | 0.72 | 0.71 |

0.7 has the best averages but is unusable: "getting better rest at night" has
five right answers and it returned 31 creators. CRM notes are embedded one by
one so "open to paid usage" can match a note.

## What still fails

Embedding ranker:

- **It cannot say "nobody fits."** "Cryptocurrency trading" returns 8 creators
  and "fitness creators in Tokyo" returns 6. An absolute score floor does not
  work: off-topic queries peak at 0.24 to 0.36 while a good query ("runners who
  review shoes") peaks at 0.27.
- **Short generic topics.** "Runners who review shoes" returns only two
  creators and misses all eight on the roster who post about running shoes
  (recall 0.00). My reading, not yet confirmed: the topic sent to the model is
  "review shoes", which sits closer to posts with "review" in them than to
  "tested four pairs of running shoes", and the cutoff then drops the right posts.
- **Precision on exact terms.** "Creaters in Calfornia who post about meal
  prep" has one right answer and returns six. Held-out P@5 is 0.59 to 0.63
  against 0.80 for keywords.

Keyword ranker: paraphrases, as in the table above. "Getting better rest at
night" returns five creators and none posted about sleep; the only shared word
is "night". Also "fitness creators who post about running" finds 3 of 6,
because posts say "long run" and the query says "running".

Parsers, held-out misses left unfixed on purpose:

- "yoga teachers with over 80k followers" (rules): "yoga" is followed by a
  noun that is not in the creator-word list, so it is read as a topic.
- "top beauty and haircare creators, half a million and up" (rules): "and up"
  is not a known way to say "or more".
- "roster talent in Texas with 60% or more of their audience in the US" (both):
  the rule parser reads 50 instead of 60. In LLM mode the number cross-check
  then overwrites whatever the model said with that wrong 50. The cross-check
  fixes more than it breaks here, but it can import a rule-parser mistake.
- "sneakerheads in New York" (LLM): read as no niche or as fashion, not streetwear.
- "streetwear creators with no more than 30,000 followers" (LLM): the model
  adds a 10,000 minimum nobody asked for.
- "makeup tutorials from creators in Chicago" (LLM): reads "beauty" as a niche;
  the expected answer treats makeup as the topic. Arguably the model is right.

What the obvious next step is: a hybrid ranker. Keywords decide whether anyone
fits at all and handle exact terms; embeddings reorder and add paraphrase
matches. That has not been built or measured.

## Limits of this eval

- Captions come from about 80 templates, so many creators share identical
  posts. That flatters keyword matching. Scores on real captions would be lower
  and noisier, and the gap to embeddings would likely close.
- Relevance is a substring check against a hand-written term list per query.
  It is cheap and repeatable but it is one person's judgment.
- 29 topic queries is a small sample. A single query moves mean P@5 by 0.03,
  and by 0.20 on the five held-out topic queries.

## Run it

    npm run dev                      # or: npx next dev --port 3210
    npm run eval -- --url http://localhost:3210

The script prints which parser and ranker actually answered. To force a mode,
start the app with `PARSER=rules` and/or `RANKER=keywords`.

## Addendum: gender filter (20 Nov 2026, later)

A gender filter was added (rule-based only: "women", "female", "men", "male",
"guys"; a possessive such as "women's running shoes" is left as topic text).
The eval now fails any case where the parser reads a gender that was not asked
for, and four cases were added to `scripts/eval_queries.json` (60 in all).

| Parser + ranker | Set | Filters | P@5 | Recall | Nobody fits |
| --- | --- | --- | --- | --- | --- |
| rules + keywords | tuned (50) | 50/50 | 0.89 | 0.77 | 4/4 |
| rules + keywords | held out (10) | 7/10 | 0.80 | 0.80 | 1/1 |
| LLM + embeddings | tuned (50) | 50/50 | 0.85 | 0.75 | 2/4 |
| LLM + embeddings | held out (10) | 6/10 | 0.63 | 1.00 | 1/1 |

All four new cases passed in both modes, and no earlier case picked up a
gender it should not have. LLM + keywords and rules + embeddings were not
rerun. The held-out filter score for LLM + embeddings moved from 7/10 to 6/10
on this run: the model read "people who post what they eat in a day" as food
creators, which is the run-to-run variation noted above, not the new rule.
The new cases were written alongside the rule, so they belong to the tuned
set and say nothing about briefs phrased differently ("female-identifying",
"dudes", "moms").

## Addendum: twelve more posts (20 Nov 2026, last)

Two roster creators (Sofia Santos, Valentina Vargas) were given six more posts
each, 979 embedded texts in all, and `data/embeddings.json` was rebuilt. Same
60 briefs, rerun in two modes:

| Mode | Tuned filters | Tuned P@5 | Tuned recall | Tuned nobody-fits | Held-out filters | Held-out P@5 | Held-out recall | Held-out nobody-fits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rules + keywords | 50/50 | 0.89 | 0.77 | 4/4 | 7/10 | 0.80 | 0.80 | 1/1 |
| LLM + embeddings | 49/50 | 0.85 | 0.75 | 2/4 | 6/10 | 0.63 | 1.00 | 1/1 |

Rules + keywords is unchanged. LLM + embeddings kept its ranking scores and
lost one tuned filter case on this run. Expected-result lists were not
edited for the new posts. LLM + keywords and rules + embeddings were not
rerun.

## Addendum: age filter (20 Nov 2026, after the posts)

Creators now have an age and a brief can ask for one ("over 30", "under 25",
"in their twenties", "aged 25 to 34"). The bug that prompted it: the LLM
parser read "fitness creators who are over 30" as fitness with over 500K
followers. Age is now read by the rules, and the eval fails any case where an
age is read that was not asked for. Five briefs were added (65 in all, marked
`"added": "age"`), one of them a follower figure that must not become an age
("over 30k followers").

| Mode | Tuned filters | Tuned P@5 | Tuned recall | Tuned nobody-fits | Held-out filters | Held-out P@5 | Held-out recall | Held-out nobody-fits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rules + keywords | 55/55 | 0.89 | 0.77 | 4/4 | 7/10 | 0.80 | 0.80 | 1/1 |
| LLM + embeddings | 55/55 | 0.84 | 0.75 | 2/4 | 7/10 | 0.63 | 1.00 | 1/1 |

All five new briefs pass in both modes and no earlier brief picked up an age.
The new cases were written alongside the rule, so they are tuned cases.
Phrasings not covered: "Gen Z", "millennials", "college-age", "30+" with no
unit. LLM + keywords and rules + embeddings were not rerun.

## Addendum: 170 creators (20 Nov 2026, night)

Fifty creators were added (beauty, skincare, hair and fashion; 46 women, 4
men), with 26 new captions. The data is now 170 creators: 107 roster, 40
applicants, 23 prospects. Embeddings were rebuilt (1,390 texts). Everything
above this section was measured on 120 creators and is left as it was. Same
65 briefs; expected results are computed from the data, so they moved with
it.

| Mode | Tuned filters | Tuned P@5 | Tuned recall | Tuned nobody-fits | Held-out filters | Held-out P@5 | Held-out recall | Held-out nobody-fits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rules + keywords | 55/55 | 0.87 | 0.74 | 4/4 | 7/10 | 0.86 | 0.86 | 1/1 |
| LLM + embeddings | 54/55 | 0.88 | 0.74 | 1/4 | 7/10 | 0.70 | 1.00 | 1/1 |

What changed with more data: the two rankers are now level on precision in
the tuned set (0.87 and 0.88), where rules + keywords led before. The
embedding ranker's known weakness got worse: it returned people for three of
the four tuned briefs that nobody fits (it was two of four). The one tuned
filter miss in LLM mode is "fitness creators who post about running", read
on this run with running as a second creator type. The cutoffs were not
retuned for the larger data. LLM + keywords and rules + embeddings were not
rerun. The three briefs in docs/DEMO.md return the same counts as before
(9; 1 on the roster and 4 not yet; 7).

## Addendum: 178 creators (20 Nov 2026, late night)

Eight more roster creators were added (high-reach beauty and fashion), 178 in
all: 115 roster, 40 applicants, 23 prospects. Embeddings were rebuilt. With no
topic in the brief the app now lists every stage together; a brief with a
topic still lists the roster first, which is what the eval measures. Same 65
briefs.

| Mode | Tuned filters | Tuned P@5 | Tuned recall | Tuned nobody-fits | Held-out filters | Held-out P@5 | Held-out recall | Held-out nobody-fits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rules + keywords | 55/55 | 0.86 | 0.74 | 4/4 | 7/10 | 0.86 | 0.86 | 1/1 |
| LLM + embeddings | 55/55 | 0.88 | 0.75 | 1/4 | 7/10 | 0.70 | 1.00 | 1/1 |

On precision the two are level. They differ when nobody fits: for "creators
who post about cryptocurrency trading" rules + keywords returned nobody and
LLM + embeddings returned 21 people. The held-out set is 10 briefs, 5 of them
with a topic, so its figures move a lot on one brief. LLM + keywords and
rules + embeddings were not rerun on this data.

## Addendum: budget filter and final numbers (20 Nov 2026, last run)

A dollar amount in a brief is now a filter: the most one creator can be paid
for a reel ("budget $2,000 each", "under $5k a reel"). It rules out only
creators with a known, higher rate; applicants and prospects have no rate. A
total campaign budget is read and discarded. "US audience 60%+" (figure after
the words) is now read too. Both are read by the rules, and the eval fails
any case where a budget is read that was not asked for. Five briefs were
added (70 in all, marked `"added": "budget"`); they are tuned cases.

| Mode | Tuned filters | Tuned P@5 | Tuned recall | Tuned nobody-fits | Held-out filters | Held-out P@5 | Held-out recall | Held-out nobody-fits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rules + keywords | 60/60 | 0.88 | 0.77 | 4/4 | 7/10 | 0.86 | 0.86 | 1/1 |
| LLM + embeddings | 60/60 | 0.88 | 0.77 | 1/4 | 7/10 | 0.66 | 0.80 | 1/1 |

Tuned precision and recall are the same in both modes. They differ when
nobody fits: "creators who post about cryptocurrency trading" returned
nobody with rules + keywords and 22 people with LLM + embeddings. The
held-out drop for LLM + embeddings (0.70 and 1.00 in the previous section)
is one brief: "creaters in Calfornia who post about meal prep" is read the
same as before, but with eight more California-heavy roster creators in the
ranking it now returns five roster creators, none of whom posts about meal
prep, and that hides the one prospect who does. The held-out set has five
topic briefs, so one brief moves it this much. A held-out brief that still
fails in both modes, "60% or more of their audience in the US", was left
unfixed on purpose so the set stays held out. LLM + keywords and rules +
embeddings were not rerun.


## Addendum: hybrid ranker, all six modes (20 Nov 2026, after the budget filter)

The hybrid ranker argued for above is built and is now the default when a key
is set (`rankHybrid` in `src/lib/search.ts`). Keywords decide who is eligible
and embeddings decide the order:

1. No creator who passes the filters has any word of the topic: return
   nobody.
2. Some creator has every word of the topic ("meal prep", "wedding guest
   outfits"): only the keyword matches (same 0.5 cutoff as the keyword
   ranker) are eligible, ordered by embedding score. Each card quotes the
   post that contains the words.
3. Only partial keyword matches ("getting better rest at night" when the
   posts say "sleep"): the brief is treated as a paraphrase and the embedding
   ranker runs as before.

All six modes were run on the same server, 178 creators, 70 briefs (60 tuned,
10 held out). `scripts/eval.py` now takes `--parser rules` and `--ranker
keywords|embeddings|hybrid`, which the API accepts per request. Full output
of each run is in [eval-runs/](eval-runs/).

| Parser + ranker | Tuned filters | Tuned P@5 | Tuned recall | Tuned nobody-fits | Held-out filters | Held-out P@5 | Held-out recall | Held-out nobody-fits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rules + keywords (no key) | 60/60 | 0.88 | 0.77 | 4/4 | 7/10 | 0.86 | 0.86 | 1/1 |
| Rules + embeddings | 60/60 | 0.88 | 0.80 | 1/4 | 7/10 | 0.62 | 0.69 | 0/1 |
| Rules + hybrid | 60/60 | 0.96 | 0.86 | 4/4 | 7/10 | 0.86 | 0.96 | 1/1 |
| LLM + keywords | 59/60 | 0.88 | 0.75 | 4/4 | 7/10 | 0.86 | 0.86 | 1/1 |
| LLM + embeddings | 60/60 | 0.91 | 0.80 | 1/4 | 7/10 | 0.66 | 0.80 | 1/1 |
| LLM + hybrid (default with a key) | 60/60 | 0.99 | 0.84 | 4/4 | 7/10 | 0.82 | 0.96 | 1/1 |

What changed, brief by brief (rule parser, so the parser is not a variable):

- Nobody-fits: "cryptocurrency trading", "fitness creators in Tokyo" and
  "Skincare in New York or Los Angeles, 50K+, sunscreen" return nobody with
  the hybrid; embeddings returned 22, 6 and 4 people.
- Near misses: "creaters in Calfornia who post about meal prep" goes from
  P@5 0.00 (embeddings) to 1.00, "Runners who review shoes" from 0.50 and
  recall 0.00 to 1.00 and 1.00, "20-100K fashion creators who do wedding
  guest outfits" from 0.60 to 1.00.
- Paraphrase is kept: "getting better rest at night" is 0.00 with keywords
  and 1.00 with embeddings and the hybrid.

How it was chosen, and what that means for the numbers:

- The first version had only steps 1 and 2 (the keyword set, reordered). With
  the rule parser it scored tuned P@5 0.91, recall 0.77, nobody-fits 4/4, and
  lost every paraphrase brief ("getting better rest at night" 0.00). Step 3
  was added after reading the per-brief comparison of the three rankers.
- That comparison listed held-out briefs too. The rule in step 3 was written
  for the tuned paraphrase briefs and no constant was fitted, but the
  held-out rows were on screen when it was chosen, so the held-out figures
  for the hybrid are weaker evidence than the earlier ones.
- The LLM runs are not repeatable to the last digit. LLM + embeddings scored
  tuned P@5 0.88 and recall 0.77 in the previous section and 0.91 and 0.80 in
  this run on the same code path. Differences of 0.03 between LLM rows are
  within that noise. The hybrid's gain over embeddings (0.96 against 0.88
  with the rule parser, which is repeatable) is not.
- Held-out P@5 for LLM + hybrid is 0.82, below the keyword rows (0.86): on
  that run "people who post what they eat in a day" scored 0.80 and
  "prospects who review protein powder" 0.50. Five topic briefs, so one
  brief moves it by up to 0.20.

What the hybrid still gets wrong:

- An off-topic brief that shares one ordinary word with some post falls to
  step 3 and gets embedding near misses. "fishing gear reviews" (not an eval
  case) returned 60 roster creators, because posts contain "review". The
  cases in step 1 are only briefs with no shared word at all.
- A brief with two topics is an AND: "retinol and barrier repair" for women
  over 30 returns the 2 creators who post about both, where embeddings
  returned 6.
- Recall is still low where the right answer is large and the wording
  loose: "who talks about caffeine before the gym" and "something to drink
  before lifting" return 5 of 17.

## Addendum: other models, a simpler ranker, and what the labels can measure (20 Nov 2026, late)

The question was how much closer to perfect the search could get. Three things
were tried, all on 178 creators and the same 70 briefs.

**An LLM judge in place of the rankers.** One prompt: the model gets the topic
and the 153 distinct posts and searchable notes, and returns the ones that
are about the topic. Creators with a matching post are the answer. Scored by
`scripts/experiments/judge.py` with the eval's own ground truth, topics from
the LLM parser:

| Judge model | Tuned P@5 | Tuned recall | Tuned nobody-fits | Held-out P@5 | Held-out recall | Median time |
| --- | --- | --- | --- | --- | --- | --- |
| gpt-4o-mini | 0.93 | 0.91 | 4/4 | 0.82 | 0.89 | 0.5 s |
| gpt-4.1-mini | 0.92 | 0.93 | 4/4 | 0.68 | 0.69 | 0.5 s |
| gpt-5.4-nano | 0.94 | 0.91 | 4/4 | 0.63 | 0.80 | 0.9 s |
| gpt-5.4-mini | 0.95 | 0.91 | 4/4 | 0.80 | 0.80 | 1.3 s |
| gpt-6-luna | 0.96 | 0.94 | 4/4 | 0.72 | 0.69 | 0.9 s |
| LLM + hybrid, for comparison | 0.99 | 0.84 | 4/4 | 0.82 | 0.96 | |

A Claude model was also tried; the script failed on the response format and
it was not scored. Inside the app (commit 5e206e6, removed afterwards), the
judge alone scored tuned P@5 0.92 and recall 0.89 with the rule parser, and
"keywords first, the judge when no creator has every word of the topic"
scored 0.95 and 0.85 with the rule parser and 0.97 and 0.87 with the LLM
parser (held out 0.77 and 0.85). Runs are in `eval-runs/rules-judge.txt`,
`rules-smart.txt` and `llm-smart.txt`.

So five models and two more architectures all land between 0.92 and 0.99 on
tuned precision, with the judge about 0.07 higher on recall and lower on
precision. Held-out moves between 0.63 and 0.89 on five briefs. Nothing here
is a clear win over the hybrid, and the hybrid was kept.

**The labels are the ceiling.** `scripts/experiments/judge_detail.py` lists
every post where the judge and the labels disagree. A label is "a caption
contains one of these strings", and reading the disagreements shows where
that breaks:

- Label errors: for "fitness creators who post about running" the term is
  "run", which also matches "brunette", "crunchy" and "farmers market run".
- Labels too narrow: "makeup tutorials" counts only captions with the word
  "makeup"; the judge also returned soft glam, foundation and winged liner
  posts. "Open to paid usage" does not count "Open to whitelisting for a
  usage fee".
- Real judge errors: "Bridal hair trial" for wedding guest outfits, "Marathon
  training week nine" for running shoes, "protective styles for a beach
  holiday" for sunburn.

The hybrid's 0.99 is partly agreement by construction: its gate is a keyword
match and so are the labels. Past about 0.95 this eval is measuring agreement
with a substring rule, not correctness. Getting closer to perfect means
hand-labelled relevance per topic and post, not another ranker.

**A stronger model for the one-line parser.** Filters read correctly, tuned
and held out (before the percentage fix below): gpt-4o-mini 60/60 and 7/10
(median 1.0 s), gpt-4.1-mini 58/60 and 6/10, gpt-5.4-mini 60/60 and 7/10,
gpt-6-luna 60/60 and 9/10 (1.4 s). gpt-6-luna reads "sneakerheads" as
streetwear and does not add a beauty filter to "makeup tutorials". It was
not switched in: every demo count was checked with gpt-4o-mini.

All four models read "60% or more of their audience in the US" as 60. The
rule parser then overwrote it with its default of 50. The cross-check now
keeps a percentage from the model when that percentage is written in the
brief and the rules' figure is not. This was a held-out case, so it no longer
counts as one: LLM + hybrid now reads 8 of 10 held-out briefs (tuned P@5
0.99, recall 0.84; held out 0.82 and 0.96, unchanged). Rules + keywords is
unchanged, line for line.

## Brief to shortlist (20 Nov 2026, late)

*Removed from the app on 22 Nov 2026; see "Reading a whole brief" at the end.
This section is kept as the record of what was run. The code is in git at
commit 88e1953. The reading step (item 1) is still in the app, without the
extra fields.*

The conclusion from the section above was that the search was near what its
eval can measure, and that the gaps left were not ranking gaps: a head count,
a total budget, "nobody with a competing deal", and briefs that arrive as an
email. So the model now reads the whole brief, and code builds the shortlist:

1. **Read** (`readBrief` in `src/lib/parse.ts`, gpt-4.1): the same filters as
   before, plus brand, product, head count, total budget, deliverable,
   deadline, "no conflicts", and whether the follower range was hedged. Every
   number returned must be traceable to the text of the brief; one that is
   not is dropped and shown as not used.
2. **Search**: unchanged.
3. **Pick** (`buildPlan` in `src/lib/plan.ts`, no model): exact matches in
   search order, then creators who meet every requirement but have no post
   about the product, each marked. A hedged follower range may stretch to
   half its minimum and double its maximum; a flat one never does. Only
   creators with an agreed rate are picked. A conflict note about the product
   excludes a creator and is quoted. With a total budget, the list is as long
   as the budget allows and stays inside it.

`scripts/eval_briefs.py` scores twelve briefs written to look like what a
brand sends (email, bullet list, forwarded note, one-paragraph ask), with
distractor numbers such as "SPF 50", "$38" and "24 shades". Reading is 16
fields per brief. A plan passes when it clears seven checks computed from the
data file and the expected reading: priced, hard requirements met, no
conflict, money adds up inside the budget, as long as it can be, exact fits
included, weaker picks marked.

| Run | Fields read | Briefs read with no mistake | Plans passing every check |
| --- | --- | --- | --- |
| Six development briefs, first run, gpt-4o-mini | 91/96 | 2/6 | 2/6 |
| Six development briefs, final code, gpt-4.1 | 96/96 | 6/6 | 6/6 |
| Six held-out briefs, first run, gpt-4.1 | 95/96 | 5/6 | 4/6 |
| Six held-out briefs after three fixes (no longer held out) | 96/96 | 6/6 | 6/6 |

Runs: `eval-runs/briefs-first-full-run.txt` and `briefs-after-fixes.txt`. On
the final code all twelve pass, which means there is no held-out brief left:
the next honest number needs new briefs.

What the first development run found, with gpt-4o-mini reading:

- "preferably 20K to 100K followers" came back with an age range of 20 to 29.
- A brief with $10K total for 5 creators came back with a per-creator rate
  of $2,000 that the brief never states. The figure check dropped it.
- "8 hair or beauty creators" came back as hair only; one brief came back
  with no topic.

Reading model, same six briefs: gpt-4o-mini 92/96 fields and 3/6 briefs;
gpt-4.1-mini 95/96 and 5/6; gpt-4.1, gpt-5.4-mini, gpt-6-luna, gpt-6-sol and
gpt-6.2-sol all 96/96 and 6/6. gpt-4.1 was the fastest of those (median
1.6 s) and scored 96/96 in two more runs, so it reads whole briefs.

What the held-out run found:

- A three-sentence brief of 140 characters was sent to the one-line parser,
  which has no "no conflicts" field. Whole-brief reading now also applies to
  anything with three sentences or more.
- A $3,000 budget covered two of the creators who post about sleep, and the
  third place was left empty although a cheaper creator who meets the brief
  existed. The plan now always considers those creators.
- Reading one held-out plan by hand found a wrong claim the checks had
  passed: a creator with a "Foundation wear test" post was listed as having
  no post about "skin tint foundation", because the embedding ranker had
  preferred a "clean girl makeup" post and cut her off. The plan now looks
  for a post with some of the topic's words before saying there is none, and
  marks it as covering part of the topic.
- "Follower range was hedged" came back true once for a brief with no
  follower range. It changes nothing, and it shows the reading is not
  identical from run to run. Five briefs run five times each gave the same
  shortlist every time.

Limits:

- Twelve briefs, written by the same person as the code. The plan checks test
  that constraints hold, not that a talent partner would choose the same
  people.
- The plan follows the search ranking and does not try to use the budget:
  one development brief gets six creators for $9,120 of $30,000.
- When too few creators have posted about the product, the list is filled
  with creators who meet the brief and have not, and says so. A brief that
  insists on proof ("who actually talk about sleep") is treated the same way.
- A conflict is found by word overlap between the note and the topic.
- Nothing is picked when nobody passes the hard requirements; one held-out
  brief (streetwear in New York or Los Angeles) correctly gets an empty list.

## Reading a whole brief (22 Nov 2026)

The step that proposed a shortlist from a pasted brief was removed. It made
the tool harder to follow than the search it sat on, and choosing people is
the talent partner's job. What is kept is the reading: a pasted brief (over
160 characters, several lines, or three sentences) goes to `readBrief`
(gpt-4.1), which returns the same filters and topic as a typed line. A head
count and a total campaign budget are not filters and are left out. Every
number must still be traceable to the text of the brief. The person then
picks from the grid, and the shortlist bar adds up reach and cost.

`scripts/eval_briefs.py` now scores the same twelve briefs on two things:

- **Reading**, 12 fields per brief: the eleven filters and whether the topic
  names the product. A total budget that came back as a per-creator rate
  would fail the rate field.
- **Who is shown**: whether every creator the grid returns meets the
  requirements a careful reader would set (checked against the data file,
  not the app's own reading), and how many of the first five have a post
  about the product. That last figure uses loose substring labels ("makeup"
  counts for a skin tint), so it means "on topic", not "a perfect match".

All runs: LLM parser, hybrid ranker, gpt-4.1 reading, 178 creators.

| Run | Fields read | Briefs read with no mistake | Everyone shown meets the brief | First five on topic (11 briefs that showed anyone) |
| --- | --- | --- | --- | --- |
| First run after the removal | 143/144 | 11/12 | 12/12 | 0.92 |
| After one line was added to the prompt, three runs | 144/144 each | 12/12 each | 12/12 each | 0.92 each |

Saved run: `eval-runs/briefs-reading-only.txt`. The first run was not saved
to a file.

What the first run found: with the "product" field gone from what the model
returns, the sneaker shop's brief came back with the topic "store opening"
instead of sneakers. The prompt now says that for an event the topic is what
the brand sells. That brief returns nobody either way, which is right:
nobody in streetwear in New York or Los Angeles posts about sneakers.

The two briefs below 5 of 5 on topic are the running shoe brief (2 of the 4
shown) and the sleep brief (3 of 5).

The search eval was rerun after the removal and did not move:

| Parser + ranker | Tuned filters | Tuned P@5 | Tuned recall | Tuned nobody-fits | Held-out filters | Held-out P@5 | Held-out recall | Held-out nobody-fits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rules + keywords | 60/60 | 0.88 | 0.77 | 4/4 | 7/10 | 0.86 | 0.86 | 1/1 |
| Rules + hybrid | 60/60 | 0.96 | 0.86 | 4/4 | 7/10 | 0.86 | 0.96 | 1/1 |
| LLM + hybrid (default with a key) | 60/60 | 0.99 | 0.84 | 4/4 | 8/10 | 0.82 | 0.96 | 1/1 |

The other three modes were not rerun. Held-out filters for LLM + hybrid read
8/10 on this run and 7/10 on 20 Nov; the model's reading of one held-out
brief differs between runs.

What the simpler version no longer does:

- It does not fill a list to the brief's head count. A brief that asks for
  eight and has one roster creator who posts about the product shows that
  one, plus applicants and prospects who fit. To see everyone who meets the
  requirements whether or not they post about the product, remove the
  "posts about" chip.
- It does not hold picks to a total budget. The shortlist bar shows the
  running cost and the person compares it with the brief.
- "Nobody with a competing deal" is not applied as a rule. A creator whose
  conflict note overlaps the topic is still shown, with the note in a "Check
  before pitching" box.

Limits: twelve briefs, written by the same person as the code, none held
out. The only held-out reading figure is from 20 Nov with the earlier
16-field reading: 95/96 fields and 5 of 6 briefs on the first run.
