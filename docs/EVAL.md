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
