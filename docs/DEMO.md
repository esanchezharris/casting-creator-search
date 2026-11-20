# Two-minute demo script

A shot-by-shot script for a screen recording. Spoken lines are in quotes and
come to about 280 words, which is two minutes at an unhurried pace.

Every number below was read off the app and `docs/EVAL.md` on 20 Nov 2026 with
the default dataset (seed 11), rule parser and keyword ranking. If you reseed
or add a key, re-check them before recording.

## Before you record

- `npm run dev`, open the page at 1440px wide, clear any old shortlist.
- The profiles have no photos yet. Frames show initials and "1 of 5". Either
  say so in one clause (the script does) or add real photos first.
- Have `docs/EVAL.md` open in a second tab, scrolled to the results table.
- Pressing Enter in the search box hands the keyboard to the grid, so the
  shortcuts in shot 4 work straight away.

## Shots

**1. The page, nothing typed (0:00 to 0:12)**

> "A brand sends a brief and expects names and prices the same day. So the
> first question is always the same: who on our roster fits? This is a casting
> tool that answers it from one sentence."

**2. Type the brief (0:12 to 0:32)**

Type `Fitness creators who post about energy drinks` and press Enter. Point at
the chips as they appear, then at "9 creators".

> "I type the brief the way the brand wrote it. It is split into filters I can
> see and edit: creator type, fitness; topic, energy drinks. Nine people on
> the roster match, and each card quotes the post that got them there."

**3. Sweep three cards (0:32 to 0:47)**

Move the pointer slowly left to right across the first three photo frames.

> "Sweeping across a card flips through the profile without opening it. These
> are placeholder frames for now; the data is fictional. Under each one: recent
> reach, engagement, US audience, and the rate we have agreed."

**4. Keyboard shortlist and copy (0:47 to 1:07)**

Press Right, `S`, Right, Right, Right, `S`. Scroll or arrow to the last card
(Jade Santos) and pause on its warning. Press Space to open quick look, Esc to
close. Click "Copy shortlist".

> "Arrow keys move, S shortlists. This last creator posts about energy drinks
> but the notes say they are exclusive with an energy drink brand until March,
> so the card warns me before I pitch them. Copy gives me the brief, names,
> reach and prices, ready to paste to the brand."

**5. The narrower brief (1:07 to 1:30)**

Press `/`, change the brief to `Fitness creators in Florida who post about
energy drinks`, press Enter. The count reads "2 on the roster, 4 not yet".
Scroll to the "Not on the roster yet" heading.

> "Now the brand wants Florida. Only two on the roster fit. So the tool also
> shows four applicants and prospects who do, with no rate yet. That tells a
> talent partner exactly who is worth signing for this brief."

**6. The eval table (1:30 to 1:50)**

Switch to `docs/EVAL.md`, results table. Point at row 4, then row 5, then the
"getting better rest at night" line.

> "I measured it on fifty-six test briefs. The parser gets all forty-six
> regression cases, but only seven of ten I held back. Precision at five is
> 0.88. And it fails on paraphrase: ask for 'getting better rest at night' and
> none of the five results posted about sleep. Keywords can't know rest means
> sleep."

**7. Close (1:50 to 2:00)**

Back to the app.

> "That gap is what embeddings are for. The ranker is written but not yet
> measured. Next: run it, move vectors to pgvector, and point it at real CRM
> data."

## Numbers used, and where they come from

| Line | Number | Source |
| --- | --- | --- |
| Shot 2 | 9 roster matches | app, brief 1 |
| Shot 4 | conflict on the last card | app, brief 1, ninth result |
| Shot 5 | 2 on the roster, 4 not yet | app, brief 2 |
| Shot 6 | 56 briefs; 46/46 and 7/10 filters | `docs/EVAL.md`, rows 4 and 5 |
| Shot 6 | P@5 0.88 | `docs/EVAL.md`, row 4 |
| Shot 6 | "getting better rest at night": P@5 0.00 | `docs/EVAL.md`, "What still fails" |
