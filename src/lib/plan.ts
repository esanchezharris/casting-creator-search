import { ParsedQuery, Plan, PlanPick, SearchResult } from "./types";

/** A brand that does not say how many creators it wants gets a short list of this many. */
export const DEFAULT_COUNT = 5;

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`
  : String(n);

/**
 * Turn ranked search results into a shortlist that meets the brief's head count and total budget.
 * No model is involved: the picks follow the search ranking, so every one can be checked by hand.
 *
 *   - Candidates are the exact matches in search order, then `wider`: creators who meet the
 *     brief's requirements but are a weaker fit (see widen() in search.ts). Exact matches always
 *     come first.
 *   - Only creators with an agreed rate can be picked, because only they can be priced.
 *   - A creator whose conflict note touches the topic is never picked, and is listed with the note.
 *   - With a total budget, the plan first finds how many creators the budget can cover at all
 *     (the cheapest k), then walks the candidates and takes each one unless taking them would
 *     leave too little for the cheapest way to fill the remaining places.
 *   - Applicants and prospects who fit exactly are listed as people to sign when the roster's
 *     exact matches cannot fill the count. They have no rate, so they are not in the total.
 */
export function buildPlan(q: ParsedQuery, results: SearchResult[], offRoster: SearchResult[], wider: PlanPick[] = []): Plan | null {
  const ask = q.brief;
  if (!ask) return null;
  const want = ask.count ?? DEFAULT_COUNT;
  const budget = ask.totalBudget;

  const topic = q.semantic.trim();
  // A search result with nothing to quote matched on the bio alone, and one whose best post has
  // only some of the topic's words ("running" for "road running shoes") is a weaker match. Both
  // stay where the search ranked them, and the plan says so.
  const candidates: PlanPick[] = [
    ...results.map((r) => ({ ...r, note: !topic ? null : !r.reason ? `no recent post about ${topic}` : r.partial ? `the post covers only part of "${topic}"` : null })), ...wider,
  ].filter((r) => r.creator.rate != null);
  const rate = (r: SearchResult) => r.creator.rate as number;
  const eligible = candidates.filter((r) => !r.warning);
  const exact = eligible.filter((r) => !r.note).length;

  // How many places can be filled at all: limited by who is eligible, then by what the budget covers.
  let target = Math.min(want, eligible.length);
  if (budget != null) {
    const cheapest = eligible.map(rate).sort((a, b) => a - b);
    let sum = 0, k = 0;
    while (k < target && sum + cheapest[k] <= budget) sum += cheapest[k++];
    target = k;
  }

  const picks: PlanPick[] = [];
  const leftOut: Plan["leftOut"] = [];
  let total = 0, tooDear = 0;
  for (let i = 0; i < candidates.length && picks.length < target; i++) {
    const r = candidates[i];
    if (r.warning) { leftOut.push({ id: r.creator.id, name: r.creator.name, why: r.warning }); continue; }
    if (budget != null) {
      const need = target - picks.length - 1;
      const rest = candidates.slice(i + 1).filter((x) => !x.warning).map(rate).sort((a, b) => a - b).slice(0, need);
      if (rest.length < need || total + rate(r) + rest.reduce((s, x) => s + x, 0) > budget) {
        tooDear++;
        continue;
      }
    }
    picks.push(r);
    total += rate(r);
  }

  const notes: string[] = [];
  const proven = picks.filter((r) => r.reason && !r.partial).length;
  const part = picks.filter((r) => r.reason && r.partial).length;
  const silent = picks.length - proven - part;
  const outside = picks.filter((r) => r.outside).length;
  if (topic && picks.length && proven < picks.length) {
    const has = (n: number) => (n === 1 ? "has" : "have");
    notes.push([
      `${proven === 0 ? "None" : proven} of the ${picks.length} ${has(proven)} a recent post about ${topic}`,
      part ? `${part} ${has(part)} a post that covers part of it` : "",
      silent ? `${silent} ${has(silent)} none` : "",
    ].filter(Boolean).join("; ") + ". All of them meet the brief's requirements.");
  }
  if (outside) notes.push(`${outside} ${outside === 1 ? "is" : "are"} just outside the follower range, which the brief gave as a preference.`);
  if (tooDear) notes.push(`${tooDear} ranked higher ${tooDear === 1 ? "was" : "were"} passed over: ${tooDear === 1 ? "their rate" : "their rates"} would not leave enough of the ${money(budget ?? 0)} for a list of ${target}.`);
  if (picks.length < want) {
    notes.push(eligible.length >= want
      ? `The budget of ${money(budget ?? 0)} covers ${picks.length} of the ${want} creators asked for.`
      : `${want} creators were asked for; ${eligible.length} on the roster ${eligible.length === 1 ? "passes" : "pass"} the hard requirements` +
        (picks.length < eligible.length ? `, and the budget of ${money(budget ?? 0)} covers ${picks.length} of them.` : "."));
  }
  const alternates = exact < want ? [...results.filter((r) => r.creator.rate == null), ...offRoster].filter((r) => !r.warning).slice(0, want) : [];

  const reach = picks.reduce((s, r) => s + r.creator.recentReach, 0);
  const lines: string[] = [];
  const title = [ask.brand, ask.product].filter(Boolean).join(", ");
  lines.push(`Shortlist${title ? ` for ${title}` : ""}: ${picks.length} ${picks.length === 1 ? "creator" : "creators"}, ` +
    `${money(total)}${budget != null ? ` of ${money(budget)}` : ""}, ${compact(reach)} combined recent reach.`);
  if (ask.deliverable || ask.deadline) lines.push([ask.deliverable, ask.deadline].filter(Boolean).join("; ") + ".");
  lines.push("");
  picks.forEach((r, i) => {
    const c = r.creator;
    lines.push(`${i + 1}. ${c.name} (${c.handle}), ${[c.city, c.region || c.country].filter(Boolean).join(", ")}: ${compact(c.followers)} followers, ` +
      `${compact(c.recentReach)} recent reach, ${c.engagement}% engagement, ${c.audience.us}% US audience. ${money(rate(r))} per reel.`);
    if (r.reason) lines.push(`   ${r.reason}`);
    if (r.note) lines.push(`   Note: ${r.note}.`);
  });
  if (alternates.length) {
    lines.push("", "Fit the brief but are not signed yet (no agreed rate):");
    for (const r of alternates) lines.push(`- ${r.creator.name} (${r.creator.handle}), ${r.creator.stage}: ${compact(r.creator.recentReach)} recent reach, ${r.creator.audience.us}% US audience.`);
  }
  if (leftOut.length) {
    lines.push("", "Left out:");
    for (const l of leftOut) lines.push(`- ${l.name}: ${l.why}`);
  }
  if (notes.length) lines.push("", ...notes);

  return { want, budget, picks, total, reach, alternates, leftOut, notes, reply: lines.join("\n") };
}
