# Casting: creator search demo

## Why this exists
Emilio is applying for a remote engineering internship at a creator
marketing agency. He has to send a 2-minute demo of something he built. Their
interns work on the team's CRM, creator search and data tools, and LLM
features, and the posting says they want people who read and test AI output
carefully. This project is that demo: natural-language creator search with a
fast visual preview, plus an eval that shows the search was measured.

Deadline: Friday night, Nov 20 2026. Total budget is about 10 hours, so prefer
finishing and polishing what is here over adding new surface area.

## How the agency works (from its public pages, Nov 2026)
We have not seen their CRM. This is what their site says, and the demo should
mirror it.

- Two sides. Brands send a brief (product, budget, dates, the look) and are
  promised a short list of hand-picked creators with prices the same day. The agency
  then runs one contract, drafts, approvals and reporting.
- Creators come in three ways, so a creator record has a stage:
  1. Roster: creators the agency already works with, each with one talent partner.
  2. Applicants: creators apply with a public Instagram; a person reviews
     each profile.
  3. Prospects: talent partners also go out and find creators who fit a
     brand, start the conversation and set up a call.
- What they judge a creator on: audience trust (comments, saves, shares),
  content quality, recent reach and engagement (weighted above follower
  count), category fit, reliability, brand safety, usage needs, price.
- Audience location matters more than where the creator lives. Most briefs
  come from US brands, so a strong US audience gets the most offers.
- Talent partners are told to keep clean notes so anyone can pick up a
  creator's thread. Notes are part of the record.

What this means for the demo: it is a casting tool for answering a brief from
the roster first, and when the roster is thin it shows which applicants and
prospects are worth signing. It searches one internal database across all
three stages. It does not crawl social platforms for strangers.

## Commands
    npm run dev      # http://localhost:3000
    npm run build    # must pass before you call anything done
    npm run seed     # regenerate data/creators.json (178 fictional creators, seed 11)
    npm run embed    # needs OPENAI_API_KEY; writes data/embeddings.json (rerun after a reseed)
    npm run eval     # needs the app running; prints parser + P@5 scores
    npm run eval:briefs  # needs the app running and a key; scores how whole pasted briefs are read

## How it works
- `src/lib/parse.ts`: query -> `ParsedQuery` (niches, locations, stages,
  gender, age range, follower range, min engagement, min US audience, free-text `semantic`). Two parsers: deterministic
  rules (always available) and an LLM call with JSON output. LLM output goes
  through `sanitize()` and falls back to rules on any error.
- `src/lib/search.ts`: hard filters, then ranking. Keyword ranking (idf with a
  coverage penalty) is the baseline. With `data/embeddings.json` and a key,
  ranking uses per-post embeddings and quotes the closest post as the reason.
- `src/app/api/search/route.ts`: `POST {query}` or `POST {filters}` (chips
  edited in the UI). Returns which parser and ranker actually ran.
- `src/app/page.tsx` and `src/components/`: a dashboard. `FilterPanel` is the
  collapsible sidebar (tick boxes with counts, sliders with typed boxes;
  gender is one of the filters), `FilterChips` shows how the brief was read,
  `CreatorCard` has the scrub preview (pointer x-position over the photo picks
  the image), `QuickLook` is a modal laid out like a post: media on the left,
  the post for that photo with likes and top comments on the right.
- `scripts/`: Python, standard library only. Keep it that way.

## State of things
Everything below was run on 20 Nov 2026.

Keys: there is no `.env.local`, but `OPENAI_API_KEY` and `UNSPLASH_ACCESS_KEY`
are exported in Emilio's shell. So `npm run dev` on his machine runs the LLM
parser and the hybrid ranker by default. Force the baseline with
`PARSER=rules RANKER=keywords`.

Working and measured: pipeline model (stage, partner, audience, reach, notes,
roster-only rate), roster-first grouping, both parsers, both rankers,
`scripts/embed.py`, chips with editors and "Add filter", scrub preview, quick
look, shortlist with localStorage and copy text, keyboard nav, eval with
recall and a held-out set in all four parser/ranker modes. Numbers, how both
cutoffs were chosen and every known miss are in docs/EVAL.md. Short version:
rules + keywords is the most precise on this data (P@5 0.88 tuned, 0.80 held
out); embeddings win on paraphrase but cannot return "nobody" and miss
"runners who review shoes".

Photos and clips: AI-generated on Higgsfield (Soul 2.0 for the first
portrait, Nano Banana Pro with that portrait as a reference for four more
scenes, Kling 4.0 Flash for 5-second clips with sound). Prompts come from
`scripts/media_prompts.py` (one hand-written scene per caption, a seeded look
per creator). Files live in `public/creators/<id>/` (`1.jpg` to `5.jpg`,
optional `clip.mp4`); `python3 scripts/apply_media.py` points
`data/creators.json` at them and records which post each photo shows
(`photoPosts`). Rerun it after `npm run seed`. Likes and top comments per post
(`reactions`) come from the seed script. All 170 creators have five photos
and 23 have a clip (20 Nov). Lesson from the batch: Soul 2.0 draws app chrome
and garbled labels when the prompt says "Instagram", "phone" or "selfie";
Nano Banana Pro with a face reference was reliable, so every photo 1 was
redone that way. Every set was reviewed on contact sheets; known soft spots
are in the docstring of `scripts/media_prompts.py`.

UI: rebuilt on Tailwind 4 and shadcn (Base UI flavour) on 20 Nov. Components
are in `src/components/ui`. Emil Kowalski's skills are installed in
`.agents/skills` (read `emil-design-eng` before touching motion).

Posts and media order (20 Nov, late): each caption has `postDays` (seed
script) and `images` is ordered newest post first by `apply_media.py`. A clip
replaces the photo it was made from (`videoAt`), in the card and in quick
look, and plays muted only while its frame is showing. Quick look has its own
Recent / Popular order. Sofia Santos (c004) and Valentina Vargas (c116) have
six extra posts and photos (`EXTRA_POSTS` in `scripts/seed.py`, photos 6 to
11 prompted by hand). After a reseed run `apply_media.py` and `npm run embed`.

Cards preview the newest five posts only and keep the frame last looked at;
a click opens quick look on that post. Clip stills are the clip's own first frame
(`clip.jpg`, cut with ffmpeg; rerun `apply_media.py` after adding a clip).
In quick look the big photo does not follow the mouse; thumbnails and `,` `.`
change it.

Second wave (20 Nov, night): 50 more creators (c121 to c170), drawn from
their own random stream in `glam_wave()` in `scripts/seed.py` so the first
120 never change. They are beauty, skincare, hair and fashion only, 46 women
and 4 men, with 26 new captions (`CAPTIONS_MORE`) and matching scenes. The
data is now 170: 107 roster, 40 applicants, 23 prospects; 131 women; 101
with a beauty, skincare, hair or fashion first niche, beauty the largest.
Five clips (c043, c076, c100, c102, c119) were remade from their clean first
photo.

Headliners (20 Nov, late night): eight more roster women (c171 to c178,
`headliners()` in `seed.py`), 350K to 900K followers, glam captions only,
and a more polished prompt style in `media_prompts.py`. Emilio found the
earlier sets too average-looking. Total is 178 (115 roster).

Default view: with no topic the search returns every stage in one list by
recent reach. Roster-first grouping applies only when the brief has a topic.
The sort control offers "Best match" only then too: with no topic it would be
the same order as "Recent reach" (24 Nov).

Budget (20 Nov, last): `maxRate` in `ParsedQuery`, read by the rules from a
dollar amount, with a "Rate per reel" slider. It never rules out a creator
with no rate. `tools/try_parse.ts` prints how the rule parser reads a brief
(`npx tsx tools/try_parse.ts "..."`). docs/DEMO.md ends with a table of
tested briefs.

Age (20 Nov, last): each creator has `age`, drawn in `seed.py` from the same
stream `media_prompts.py` uses, so it matches the photos. Age in a brief is
read by the rules only ("over 30" is 31 and up; "over 30K" stays followers),
and when the rules read an age and no follower figure, a follower bound from
the model is dropped.

Scrolling: `src/lib/elastic.ts` gives the filter list, the page, the quick
look column and the thumbnail strip the same small pull-and-settle at their
ends (wheel and trackpad; the browser's own bounce is turned off). The
filter panel slides by animating its width for 200ms. The wheel listeners
are passive except on the thumbnail strip: Safari will not scroll an element
that has `overscroll-behavior: none` and a wheel listener that could cancel,
which left the whole page unscrollable there until 24 Nov. Scrolling is
checked in Playwright's WebKit build as well as Chromium, not in Safari
itself.

Checked in a browser at 1440px. Phone layout is out of scope: this is for a
laptop demo. Not checked: how the elastic scroll feels on a real trackpad
(tested with synthetic wheel events).

Hybrid ranker (20 Nov, last): `rankHybrid` in `src/lib/search.ts` is the
default with a key. Keywords decide who is eligible, embeddings order them,
and a brief with only partial keyword matches falls back to embeddings.
The API takes `parser: "rules"` and `ranker` per request, so
`npm run eval -- --parser rules --ranker hybrid` scores any of the six modes
on one server. Numbers for all six are in the last section of docs/EVAL.md
(LLM + hybrid, tuned: P@5 0.99, recall 0.84, nobody-fits 4/4; held out 0.82,
0.96, 1/1). Shot 5 of the demo now reads "2 on the roster, 4 not yet".

Whole briefs (22 Nov): pasting a whole brief (over 160 characters, several
lines, or three sentences) goes to `readBrief` in `src/lib/parse.ts`
(gpt-4.1, `BRIEF_MODEL` to change it). It returns the same filters and topic
as a typed line and nothing else. Every number must be traceable to the text
or it is dropped (logged on the server). A head count and a total campaign
budget are not filters: the rules strip them from a one-line brief and the
model is told to leave them out. The person picks from the grid by hand.
`npm run eval:briefs` scores twelve briefs on reading only (12 fields each)
and on who the grid then shows: 144/144 fields in three runs on 22 Nov,
none held out. Numbers are in docs/EVAL.md, "Reading a whole brief".

Removed on 22 Nov, do not add back: the proposed-shortlist step (a panel
above the grid that picked creators to a head count and total budget in
code, `plan.ts`, `PlanPanel`, `widen()`, a reply to copy). Emilio found it
made the project too convoluted to follow. It is in git at cdca6eb, and
docs/EVAL.md, "Brief to shortlist", is kept as the record of its runs.
Labelled screenshots of the current app are in `docs/screenshots/`.

View controls (23 Nov): two controls sit in the top bar after the search box.
A card size slider with a button at each end: every stop is one more or one
fewer column (3 to 7 at 1440px with the filters open), the choice is kept in
`--card-min` on `<html>` and in localStorage, and the creator at the top of
the screen stays in place while the grid reflows. Cards narrower than 180px
put the stage under the name and set the four numbers two by two (container
query in `CreatorCard`). A light/dark button: dark is the same tokens set
again under `html[data-mode="dark"]` in `globals.css` (warm charcoal). Light
is the default; the choice is remembered. `src/lib/view.ts` has the helpers
and `src/lib/view-boot.ts` the script that applies both before first paint.
Checked in a headless browser at 1440px, not by hand.

Panel beside the grid, gliding resize (23 Nov, later): Emilio works in the
app's browser pane, which is often 500 to 850px wide. The filter panel used
to lie over the page below 1024px; it now sits beside the grid from 480px up
(`side` breakpoint in `globals.css`, `SIDE` and `BESIDE` in `page.tsx`) and
only lies over the page on a phone-width window. The top bar hides the size
slider, the keyboard button and the wordmark by the room the bar has
(container queries on `bar`), not by window width. `src/lib/glide.ts` moves
cards from where they were drawn to where a layout change puts them
(transform only, 240ms, starts again from the current position if
interrupted, off for reduced motion). It runs when the card size changes by
drag or button, not by keyboard, and when the panel opens or closes: there
the grid is set to its final column count at once and released on the
panel's `transitionend`. `src/components/CardSize.tsx` is the slider: the
thumb follows the pointer between stops and settles on one when let go.
Checked in a headless browser at 1440, 838, 640 and 505px. The browser pane
drew about one frame a second while driven by tools, so the motion itself
has not been watched at full speed there.

Redraws (23 Nov, last): Emilio found the slider drag and the panel slide
jerky while the size buttons were smooth. Measured with
a CPU slowed 4x: every size change, panel toggle and hover redrew all 178
cards in React and stalled the page for 0.6 to 0.8s, which the buttons' glide
survived only because transforms run off the main thread. Fixes, keep them:
cards render through a memoised `Slot` in `page.tsx` with stable callbacks,
`FilterPanel` is memoised, and `CardSize` owns the card size and the grid's
measured width, so nothing that changes per frame or per pointer move is
state in `Page`. Mid-drag the size goes to the grids as an inline column
count (`holdColumns` in `view.ts`); the `--card-min` write to `<html>`, which
restyles every card, waits until 320ms after release. During the panel slide
the grids are held at their final width as well as column count, so the
cards are laid out once. After: longest stall about 0.1 to 0.16s at 4x, and
60 frames a second unthrottled, with `next dev`.

Continuous card size (23 Nov, last; spring added 24 Nov): with the stalls
gone Emilio still found the slider jerky, because the cards waited and then
moved a whole column at a time. A drag now zooms the results
(`src/lib/zoom.ts`: `scale` on the `data-zoom` wrapper in `page.tsx`, centred
on the row at the top of the screen), and as the drawn size passes a little
over halfway between stops the grid re-wraps into the next column count at
the same drawn size and `glide` moves the cards to their new places.

The drawn size does not follow the pointer directly. Tied straight to the
pointer it was smooth only at a medium pace: the track is 80px, so in a slow
drag the cards sat still three frames in four and then stepped 2 to 3px, and
in a fast one they jumped up to 68px in a frame; and `glide` re-applied the
old card size for one frame at every re-wrap. So the thumb stays under the
pointer and the size chases it on a critically damped spring, one frame at a
time (`STIFF` in `src/components/CardSize.tsx`, about 80ms behind at a steady
pace), and carries on to the nearest stop on release. During a drag `glide`
is called with `sized` off, so it moves cards and leaves their size to the
zoom. This is the one deliberate exception to "nothing that follows the
pointer animates". Buttons and keys still step; reduced motion gets no zoom
and no spring. Measured per frame in a headless browser at 1440px (scripts
were run from a scratch folder with playwright-core, not in the repo): slow
drag, the card changes size on 143 of 170 frames in steps of about 0.5px;
fast drag, one rise and fall peaking near 23px a frame with no held frames;
no frame over 25ms at either pace. With the CPU slowed 4x every zoom frame
takes two frames and a re-wrap about 100ms: Chrome records the page again on
each frame the scale changes (about 3ms unthrottled), and `will-change`,
`transform` in place of `scale`, and clipping the sheet made no difference.
Not watched by eye at full speed.

Look prototypes (23 Nov, decided): Emilio asked for alternative looks and
liked none of them more than the original, so the original stays and got the
view controls above. The four directions (Board, Ledger, Sheet, Paper) were
removed the same day on his word: the `/prototypes` page, its screenshots,
`FilterPanel`'s `tips` prop and `src/components/ui/select.tsx`. They were
never committed, so they are not in git. Do not rebuild them.

Tried and not kept (20 Nov): an LLM judge as the ranker, and keywords-then-
judge. Five models, all between 0.92 and 0.99 tuned P@5. The eval's labels are
substring matches and are now the ceiling; see docs/EVAL.md. The scripts are
in `scripts/experiments/`.

Port 3000 is often taken on Emilio's machine. `npx next dev --port 3210` and
`npm run eval -- --url http://localhost:3210` work.

## Design rules
The palette reference is `docs/reference/questionnaire.png`, a screen from
the agency's own applicant questionnaire (kept on Emilio's machine only: it
shows their wordmark, so `docs/reference/` is not in git). Emilio rejected a dark serif version as
over-styled, a second version (mono-caps buttons, key badges on every card)
as vibe coded, and a third (big centred headline over a search box) as a
consumer landing page. It is an internal tool: a dense dashboard with the
controls always visible. No marketing headlines, no cute copy; labels say
what a control does.
Readability beats style every time.

- Use the shadcn components in `src/components/ui` before writing anything by
  hand. Tokens are the shadcn variables at the top of `src/app/globals.css`,
  mapped to the warm palette. Do not add colors.
- Warm paper ground (#edeae4), white surfaces, 1px warm-grey borders.
  Dark mode is the same tokens on a warm charcoal ground (#191816); check
  any new surface in both.
- One sans family (Geist). Headings are weight 500 with tight tracking, never
  bold, never serif. No mono capitals.
- Cards are image-first with no chrome until the mouse or the arrow keys are
  on them, and the highlight leaves with the mouse. "Selected" is a solid
  black fill with a check.
- No accent colour in the chrome and no logo mark; the wordmark is plain
  text. No gradients. The shortlist bar has the only real shadow.
- Motion follows `.agents/skills/emil-design-eng`: pressables scale to 0.97,
  popovers grow from their trigger, nothing that follows the keyboard or the
  pointer (scrub, arrow keys, quick look) animates.
- Body text 15px or larger, secondary text 13px minimum, contrast AA.
- Never use the agency's wordmark, logo or name in the UI. The masthead says
  "Casting".

## Hard constraints
- All creators are fictional. Do not scrape Instagram or any social platform,
  and do not use real creators' names, handles or photos.
- Photos and clips are AI-generated stand-ins for fictional people. Never
  prompt for a real person's name or likeness, and keep brand logos out. The
  UI must say the roster is fictional and the media is AI-generated. Do not
  call them "AI influencers" anywhere: the product is about real creators.
- Never invent eval numbers. Every figure in docs must come from a run you
  actually did, with the mode (parser, ranker) stated.
- Do not commit `.env.local` or print keys.
- If a step needs a key that is missing, skip it, say so in your final
  report, and keep going with the rest.
