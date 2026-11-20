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
- Seven profiles have photos; the rest show initials and "1 of 5". In the
  first brief the first, sixth and last cards have photos. Sweep those.
- Have `docs/EVAL.md` open in a second tab at "Results, final code".
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

Move the pointer slowly left to right across the first card's photo (Lucia
Rossi), then across the sixth (Camila Thorne).

> "Sweeping across a photo flips through the profile without opening it. Under
> it: recent reach, engagement, US audience, and the rate we have agreed. The
> people and numbers are fictional."

**4. Keyboard shortlist and copy (0:40 to 0:58)**

Press Right, `S`. Arrow to the last card (Jade Santos) and pause on its
warning. Press Space to open quick look, Esc to close. Click "Copy shortlist".

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

Switch to `docs/EVAL.md`. Point at the results table, then at the row for
"cryptocurrency trading" in the second table.

> "I measured all of it on fifty-six test briefs, in four configurations. The
> honest result: plain rules and keywords are the most precise, 0.88 against
> 0.83. Embeddings win on paraphrase and fail somewhere else: ask about
> cryptocurrency, where nobody fits, and they still return eight people."

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
| Shot 7 | 56 briefs, four configurations | `docs/EVAL.md`, results table |
| Shot 7 | P@5 0.88 against 0.83 | `docs/EVAL.md`, tuned set: rules + keywords vs LLM + embeddings |
| Shot 7 | cryptocurrency returns 8 | `docs/EVAL.md`, second table |
