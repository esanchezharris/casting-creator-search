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
    npm run seed     # regenerate data/creators.json (120 fictional creators)
    npm run embed    # needs OPENAI_API_KEY; writes data/embeddings.json
    npm run eval     # needs the app running; prints parser + P@5 scores

## How it works
- `src/lib/parse.ts`: query -> `ParsedQuery` (niches, locations, follower
  range, min engagement, free-text `semantic`). Two parsers: deterministic
  rules (always available) and an LLM call with JSON output. LLM output goes
  through `sanitize()` and falls back to rules on any error.
- `src/lib/search.ts`: hard filters, then ranking. Keyword ranking (idf with a
  coverage penalty) is the baseline. With `data/embeddings.json` and a key,
  ranking uses per-post embeddings and quotes the closest post as the reason.
- `src/app/api/search/route.ts`: `POST {query}` or `POST {filters}` (chips
  edited in the UI). Returns which parser and ranker actually ran.
- `src/app/page.tsx`, `src/components/CreatorCard.tsx`: the UI. Scrub preview
  maps pointer x-position over the photo to an image index.
- `scripts/`: Python, standard library only. Keep it that way.

## State of things
Verified working: build, rule parser, keyword ranking, chips, scrub preview,
shortlist, keyboard nav, eval script (baseline 13/15 filters, P@5 0.91).

Not built yet: the pipeline model above. The data has no stage, audience
location, reach, notes or talent partner. PROMPT.md Phase 0 adds them.

Never run (no API keys were available when written), so expect bugs:
- `parseWithLLM` in `src/lib/parse.ts`
- `rankByEmbeddings` in `src/lib/search.ts` and `scripts/embed.py`
- `scripts/fetch_images.py` (Pexels)
Default model names in `.env.example` may be out of date. Check the provider's
current docs before assuming a name is valid.

## Design rules
The reference is `docs/reference/questionnaire.png`, a screen from the agency's
own applicant questionnaire. Look at it before any UI work. Emilio rejected an
earlier dark, high-contrast serif version as over-styled and hard to read.
Readability beats style every time.

- Tokens live at the top of `src/app/globals.css`. Use them; do not add colors.
- Warm paper ground (#edeae4), near-white rounded surfaces, 1px warm-grey
  borders, 12px and 18px radii.
- One sans family (Geist) for everything people read. Headings are weight 500
  with tight tracking, never bold, never serif.
- Mono capitals (`.label`, `.go`) only for tiny status labels and primary
  buttons. Not for body text, names or numbers.
- "Selected" is a solid black fill with white text and a check, like the
  chosen answer in the reference. Key badges (the small lettered squares) mark
  keyboard shortcuts.
- Exactly one accent: the small red dot on primary buttons. No gradients, no
  extra shadows (the floating tray has the only one), no entrance animations.
- Body text 15px or larger, secondary text 13px minimum, contrast AA.
- Inspired by their look, not a copy: never use the agency's wordmark, logo or name
  in the UI. The masthead says "Casting".

## Hard constraints
- All creators are fictional. Do not scrape Instagram or any social platform,
  and do not use real creators' names, handles or photos.
- Photos come from Pexels via `scripts/fetch_images.py` or stay as
  placeholders. The UI must say the roster is fictional.
- Never invent eval numbers. Every figure in docs must come from a run you
  actually did, with the mode (parser, ranker) stated.
- Do not commit `.env.local` or print keys.
- If a step needs a key that is missing, skip it, say so in your final
  report, and keep going with the rest.
