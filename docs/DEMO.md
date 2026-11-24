# Two-minute demo script

A shot-by-shot script for a screen recording. Spoken lines are in quotes and
come to about 290 words, which is two minutes at an unhurried pace.

Every number below was read off the app and `docs/EVAL.md` with the default
dataset (seed 11) in the mode the app runs in when `OPENAI_API_KEY` is set:
LLM parser, hybrid ranker, gpt-4.1 reading whole briefs. Shots 2, 4 and 5
were rechecked on 22 Nov 2026, after the proposed-shortlist panel was
removed. The line next to the result count should read "Read by the language
model, ranked by keywords and meaning". If it says "rule parser", the key is
not set and shot 5 will not read the brief properly.
The models are not perfectly repeatable, so run each brief once before
recording. The brief in shot 5 was read the same way and returned the same
five people three times out of three. The script has not been timed since
shots 5 and 6 were rewritten.

## Before you record

- `npm run dev`, open the page at 1440px wide, clear any old shortlist.
- Copy the brief below to the clipboard, so shot 5 is one paste. Typing it
  would submit it at the first Enter; pasting keeps the lines.

      Brand: Aster Cosmetics
      Launch: skin tint foundation, 24 shades, on shelves 3/15
      Ask: 4 beauty creators over 250K followers, 65%+ US audience, reel + usage
      Budget: $40,000 total
      Must not be exclusive with another makeup brand.

- Have `docs/EVAL.md` open in a second tab at the table "Hybrid ranker, all
  six modes", with the last section, "Reading a whole brief", ready to scroll
  to.
- With nothing typed the page lists all 178 creators, every stage together,
  highest recent reach first. A brief with a topic lists the roster first.
- A search takes one to two seconds. Wait for "Searching…" to clear before
  pressing keys.
- Every profile has five AI-generated photos, newest post first. Some have a
  short clip that plays muted while the mouse is on its frame.

## Shots

**1. The page, nothing typed (0:00 to 0:08)**

> "A brand sends a brief and expects names and prices the same day. This
> tool goes from the brief to a shortlist."

**2. One line (0:08 to 0:24)**

Type `Fitness creators who post about energy drinks` and press Enter. Point at
the chips, then at "9 creators".

> "I can type one line. A language model turns it into filters I can see and
> edit. Nine people on the roster match, each with the post that got them
> there."

**3. Sweep a card (0:24 to 0:36)**

Move the pointer slowly left to right across the first card's photo, then
press Space for quick look and Esc to close it.

> "Sweeping across a photo flips through the profile without opening it. The
> people are fictional and the photos are generated."

**4. The narrower brief (0:36 to 0:50)**

Press `/`, change the brief to `Fitness creators in Florida who post about
energy drinks`, press Enter. The count reads "2 on the roster, 4 not yet".

> "Narrow it to Florida and only two on the roster fit, so it also shows four
> applicants and prospects who would be worth signing."

**5. The whole brief (0:50 to 1:28)**

Press `/`, paste the Aster brief, press Enter. The chips read "beauty", "over
250K followers", "65%+ US audience", "posts about skin tint foundation", and
the count reads "2 on the roster, 3 not yet". Point at the chips, then at the
"Check before pitching" box on Chloe Cho's card. Tick Felix Farrow, then Nora
Hayashi in the second group. The bar reads "2 shortlisted · 825K reach ·
$5,210 · 1 to sign". Click "Copy shortlist".

> "Real briefs are emails, so I paste the whole thing. A stronger model reads
> it into the same filters: beauty, over 250K, 65 percent US audience, posts
> about skin tint foundation. The head count and the forty thousand dollar
> total are not filters, so they are left out, and any number the model
> returns that is not written in the brief gets dropped. Two on the roster
> fit, and one of them is flagged: the notes say she is exclusive with a
> makeup brand. So I pick by hand. One from the roster, one prospect whose
> post is about a skin tint, and the bar keeps the cost and who still has to
> be signed."

**6. The eval (1:28 to 1:52)**

Switch to `docs/EVAL.md`. Point at the LLM + hybrid row of the search table,
then scroll to "Reading a whole brief".

> "I measured both steps. Search, on seventy briefs: precision 0.99 on the
> ones I tuned on, 0.82 on ten I held back. Whole briefs, twelve of them
> written like the emails a brand sends: every field read correctly on all
> twelve, and everyone the grid showed met the brief. None of those twelve
> is held back any more, and the doc says so."

**7. Close (1:52 to 2:00)**

Back to the app.

> "Next is hand-labelled relevance, because my labels are now the limit, and
> real CRM data in place of the fictional roster."

Cut from the earlier script, and still working if you want them back: the
keyboard shortlist with the conflict warning on Jade Santos (arrow to the
last card of shot 2, press S), and the paraphrase `getting better rest at
night` (7 creators, the first five quoting the sleep routine post).

## Numbers used, and where they come from

| Line | Number | Source |
| --- | --- | --- |
| Shot 2 | 9 roster matches | app, LLM + hybrid |
| Shot 4 | 2 on the roster, 4 not yet | app, LLM + hybrid; `docs/eval-runs/llm-hybrid.txt` (6 expected, 6 returned) |
| Shot 5 | brief read as beauty, over 250K, 65%+ US audience, skin tint foundation | app, and `docs/eval-runs/briefs-reading-only.txt` (aster-skin-tint, read 12/12) |
| Shot 5 | 2 on the roster, 3 not yet; bar "2 shortlisted · 825K reach · $5,210 · 1 to sign" | app, 22 Nov, LLM + hybrid; `docs/screenshots/5-brief-read.png` and `6-pick-from-brief.png` |
| Shot 6 | 70 briefs, P@5 0.99 tuned and 0.82 held out | `docs/EVAL.md`, "Hybrid ranker, all six modes", LLM + hybrid; `docs/eval-runs/llm-hybrid.txt` |
| Shot 6 | twelve briefs, every field read, everyone shown meets the brief | `docs/EVAL.md`, "Reading a whole brief": 144/144 fields in three runs; `docs/eval-runs/briefs-reading-only.txt` |

## Other briefs that show well

One-line briefs, all rerun on 20 Nov 2026 in the default mode (LLM parser, hybrid ranker) on
178 creators. Counts are roster matches unless stated. Run each once before
recording; the model is not perfectly repeatable.

| Brief | Read as | Returns |
| --- | --- | --- |
| Women in their twenties with a mostly US audience for a lip oil launch | women, aged 20 to 29, 50%+ US audience, posts about lip oil | 3 |
| Fashion creators in New York for a wedding guest dress campaign, budget $2,000 each | fashion, New York, up to $2K a reel, posts about wedding guest dress | 1 |
| Beauty creators over 100K followers who do soft glam, US audience 60%+ | beauty, over 100K, 60%+ US audience, posts about soft glam | 8 |
| Women over 30 who post about retinol and barrier repair | women, aged 31 or over, skincare, posts about both retinol and barrier repair | 2 |
| Hair creators who post heatless curls, under 50K, high engagement | hair, under 50K, 5%+ engagement, posts about heatless curls | 5 |
| Roster creators who are open to whitelisting for a foundation wear test | on the roster, topic matched against CRM notes | 9, each quoting the note "Open to whitelisting for a usage fee." |
| Who on the roster can turn a reel around in 48 hours for a nail brand | on the roster, topic matched against CRM notes | 18, led by "Turns revisions around within 24 hours." (the count moves with how the model words the topic) |

Briefs that do not work and should stay out of the film: anything
with "no conflicts" or another negation (it is matched as a topic, not
applied as a rule), a jewellery brief in a follower band where nobody posts
about jewellery (a brief that shares one ordinary word with a post still gets near misses), and a total campaign budget
(only a per-creator amount becomes a filter).
