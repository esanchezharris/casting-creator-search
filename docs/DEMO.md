# Two-minute demo script

A shot-by-shot script for a screen recording. Spoken lines are in quotes and
come to about 280 words, which is two minutes at an unhurried pace.

Every number below was read off the app and `docs/EVAL.md` on 20 Nov 2026 with
the default dataset (seed 11) in the mode the app runs in when
`OPENAI_API_KEY` is set: LLM parser, embedding ranker. The line next to the
result count should read "Read by the language model, ranked by meaning". If
it says "rule parser", the key is not set and the counts in shots 5 and 6 will
differ (2 on the roster instead of 1; the paraphrase in shot 6 will fail).
The LLM is not perfectly repeatable, so run each brief once before recording.

## Before you record

- `npm run dev`, open the page at 1440px wide, clear any old shortlist.
- Every profile has five AI-generated photos (Valentina Vargas and Sofia
  Santos have eleven, to show a longer history), newest post first. The
  creators these briefs surface also have a short clip, which stands in the
  place of the photo it was made from: a play mark shows on its frame, and it
  plays muted while the mouse is on that frame. In quick look the speaker
  button turns the sound on, and "Recent / Popular" reorders the posts.
- Have `docs/EVAL.md` open in a second tab at its last section, "Budget filter
  and final numbers".
- With nothing typed the page lists all 178 creators, every stage together,
  highest recent reach first. A brief with a topic lists the roster first.
- A search takes one to two seconds (a language-model call and an embedding
  call). Wait for "Searching…" to clear before pressing keys.
- Pressing Enter in the search box hands the keyboard to the grid, so the
  shortcuts in shot 4 work straight away.

## Shots

**1. The page, nothing typed (0:00 to 0:10)**

> "A brand sends a brief and expects names and prices the same day. So the
> first question is always: who on our roster fits? This tool answers that
> from one sentence."

**2. Type the brief (0:10 to 0:28)**

Type `Fitness creators who post about energy drinks` and press Enter. Point at
the chips as they appear, then at "9 creators".

> "I type the brief as the brand wrote it. A language model splits it into
> filters I can see and edit: creator type, fitness; topic, energy drinks.
> Nine people on the roster match, each with the post that got them there."

**3. Sweep a card (0:28 to 0:40)**

Move the pointer slowly left to right across the first card's photo, then
across another.

> "Sweeping across a photo flips through the profile without opening it. Under
> it: recent reach, engagement, US audience, and the rate we have agreed. The
> people are fictional and the photos are generated."

**4. Keyboard shortlist and copy (0:40 to 0:58)**

Press Right, `S`. Arrow to the last card (Jade Santos) and pause on its
warning. Press Space to open quick look (the post and its top comments sit
beside the photo; pass the mouse along the thumbnails to reach the clip),
Esc to close. Click "Copy shortlist".

> "Arrow keys move, S shortlists. This last creator posts about energy drinks,
> but the notes say they are exclusive with an energy drink brand until March,
> so the card warns me before I pitch them. Copy gives me names, reach and
> prices to paste to the brand."

**5. The narrower brief (0:58 to 1:16)**

Press `/`, change the brief to `Fitness creators in Florida who post about
energy drinks`, press Enter. The count reads "1 on the roster, 4 not yet".
Scroll to the "Not on the roster yet" heading.

> "Now the brand wants Florida. Only one person on the roster fits. So it also
> shows four applicants and prospects who do, with no rate yet. That tells a
> talent partner who is worth signing for this brief."

**6. A paraphrase (1:16 to 1:30)**

Press `/`, type `getting better rest at night`, press Enter. Seven creators;
the first five quote "Sleep routine: magnesium, no phone, lights out by ten."

> "No post here contains the word rest. It still finds the five creators who
> post about sleep, because posts are matched by meaning, not keywords."

**7. The eval table (1:30 to 1:52)**

Switch to `docs/EVAL.md`, last section ("Budget filter and final numbers"). Point at the two
rows of the table, then at the sentence about cryptocurrency under it.

> "I measured all of it on seventy test briefs, in two configurations. On
> precision they are level: 0.88 for plain rules and keywords, and 0.88 for
> the language model with embeddings. The difference is what happens when
> nobody fits. Ask about cryptocurrency and keywords return nobody;
> embeddings still return twenty-two people."

**8. Close (1:52 to 2:00)**

Back to the app.

> "So next is a hybrid ranker, pgvector instead of a JSON file, and real CRM
> data in place of the fictional roster."

## Numbers used, and where they come from

| Line | Number | Source |
| --- | --- | --- |
| Shot 2 | 9 roster matches | app, brief 1, LLM + embeddings |
| Shot 4 | conflict on the last card | app, brief 1, ninth result (Jade Santos) |
| Shot 5 | 1 on the roster, 4 not yet | app, brief 2, LLM + embeddings |
| Shot 6 | 7 returned, 5 about sleep | app; `docs/eval-runs/llm-embeddings.txt` (5 expected, 7 returned, P@5 1.00) |
| Shot 7 | 70 briefs, two configurations | `docs/EVAL.md`, last section |
| Shot 7 | P@5 0.88 and 0.88 | `docs/EVAL.md`, last section, tuned set: rules + keywords, LLM + embeddings |
| Shot 7 | cryptocurrency returns 22, or nobody | final eval runs of 20 Nov on 178 creators: LLM + embeddings, rules + keywords |

## Other briefs that show well

All run on 20 Nov 2026 in the default mode (LLM parser, embedding ranker) on
178 creators. Counts are roster matches unless stated. Run each once before
recording; the model is not perfectly repeatable.

| Brief | Read as | Returns |
| --- | --- | --- |
| Women in their twenties with a mostly US audience for a lip oil launch | women, aged 20 to 29, 50%+ US audience, posts about lip oil | 4 |
| Fashion creators in New York for a wedding guest dress campaign, budget $2,000 each | fashion, New York, up to $2K a reel, posts about wedding guest dress | 1 |
| Beauty creators over 100K followers who do soft glam, US audience 60%+ | beauty, over 100K, 60%+ US audience, posts about soft glam | see note |
| Women over 30 who post about retinol and barrier repair | women, aged 31 or over, skincare, posts about retinol and barrier repair | 6 |
| Hair creators who post heatless curls, under 50K, high engagement | hair, under 50K, 5%+ engagement, posts about heatless curls | 5 |
| Roster creators who are open to whitelisting for a foundation wear test | on the roster, topic matched against CRM notes | 9, each quoting the note "Open to whitelisting for a usage fee." |
| Who on the roster can turn a reel around in 48 hours for a nail brand | on the roster, topic matched against CRM notes | 29, led by "Turns revisions around within 24 hours." |

Note: the soft glam brief returned 11 before the audience figure was read
correctly (it was read as 50%); the count with 60% was not rechecked in the
browser. Briefs that do not work and should stay out of the film: anything
with "no conflicts" or another negation (it is matched as a topic, not
applied as a rule), a jewellery brief in a follower band where nobody posts
about jewellery (embeddings return near misses), and a total campaign budget
(only a per-creator amount becomes a filter).
