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
    npm run seed     # regenerate data/creators.json (120 fictional creators, seed 11)
    npm run embed    # needs OPENAI_API_KEY; writes data/embeddings.json (rerun after a reseed)
    npm run eval     # needs the app running; prints parser + P@5 scores

## How it works
- `src/lib/parse.ts`: query -> `ParsedQuery` (niches, locations, stages,
  follower range, min engagement, min US audience, free-text `semantic`). Two parsers: deterministic
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
parser and the embedding ranker by default. Force the baseline with
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
(`reactions`) come from the seed script. All 120 creators have five photos
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

Scrolling: `src/lib/elastic.ts` gives the filter list, the page, the quick
look column and the thumbnail strip the same small pull-and-settle at their
ends (wheel and trackpad; the browser's own bounce is turned off). The
filter panel slides by animating its width for 200ms.

Checked in a browser at 1440px. Phone layout is out of scope: this is for a
laptop demo. Not checked: how the elastic scroll feels on a real trackpad
(tested with synthetic wheel events).

Not built: a hybrid ranker (keywords to decide if anyone fits, embeddings to
reorder), which docs/EVAL.md argues is the next step.

Port 3000 is often taken on Emilio's machine. `npx next dev --port 3210` and
`npm run eval -- --url http://localhost:3210` work.

## Design rules
The palette reference is `docs/reference/questionnaire.png`, a screen from
the agency's own applicant questionnaire. Emilio rejected a dark serif version as
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
