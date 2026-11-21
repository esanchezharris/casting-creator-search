"use client";

import { Check, Copy, Plus } from "lucide-react";
import { compact, initials, money } from "@/components/CreatorCard";
import { Button } from "@/components/ui/button";
import type { BriefAsk, Plan, PlanPick } from "@/lib/types";

/** What the brief asked for, as the reader understood it. Shown so a wrong reading is visible. */
function askLine(ask: BriefAsk): string {
  return [
    [ask.brand, ask.product].filter(Boolean).join(", "),
    ask.count != null && `${ask.count} creators`,
    ask.totalBudget != null && `${money(ask.totalBudget)} total`,
    ask.deliverable, ask.deadline,
    ask.noConflicts && "no competitor conflicts",
    ask.flexibleSize && "follower range is a preference",
  ].filter(Boolean).join(" · ");
}

/**
 * The shortlist the engine proposes for a brief: who, at what rate, and why, with the total
 * against the budget. The rows follow the search ranking; nothing here is written by a model.
 */
export function PlanPanel({ ask, plan, picked, onAdd, onCopy, onOpen }: {
  ask: BriefAsk;
  plan: Plan;
  /** Ids already on the shortlist. */
  picked: Set<string>;
  onAdd: () => void;
  onCopy: () => void;
  onOpen: (pick: PlanPick) => void;
}) {
  const done = plan.picks.length > 0 && plan.picks.every((p) => picked.has(p.creator.id));
  const line = askLine(ask);
  return (
    <section aria-label="Proposed shortlist" className="mt-2 rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3 pb-2.5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium">
            Proposed shortlist
            <span className="ml-2 font-normal text-muted-foreground tabular-nums">
              {plan.picks.length} of {plan.want} · {money(plan.total)}{plan.budget != null && ` of ${money(plan.budget)}`} · {compact(plan.reach)} reach
            </span>
          </h2>
          {line && <p className="mt-0.5 text-[13px] text-pretty text-muted-foreground">Brief read as: {line}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="press h-8 gap-1.5 bg-card px-2.5 text-[13px]" onClick={onCopy} disabled={!plan.picks.length}>
            <Copy className="size-3.5" />Copy reply
          </Button>
          <Button size="sm" className="press h-8 gap-1.5 rounded-lg px-3 text-[13px]" onClick={onAdd} disabled={done || !plan.picks.length}>
            {done ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}{done ? "On the shortlist" : "Add to shortlist"}
          </Button>
        </div>
      </div>

      {plan.picks.length > 0 && (
        <ol className="border-t">
          {plan.picks.map((p, i) => {
            const c = p.creator;
            return (
              <li key={c.id} className="border-b last:border-b-0">
                <button
                  type="button" onClick={() => onOpen(p)}
                  className="grid w-full grid-cols-[20px_32px_minmax(140px,1.1fr)_minmax(0,3fr)_84px] items-center gap-x-3 px-4 py-1.5 text-left text-[14px] hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span className="text-[13px] text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="grid size-8 place-items-center overflow-hidden rounded-full bg-muted text-[12px]">
                    {c.images[0] ? <img src={c.images[0]} alt="" className="size-full object-cover" /> : initials(c.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-[13px] text-muted-foreground tabular-nums">
                      {compact(c.followers)} · {compact(c.recentReach)} reach · {c.audience.us}% US
                    </span>
                  </span>
                  <span className="min-w-0 text-[13px] text-muted-foreground">
                    {p.reason && <span className="block truncate">{p.reason}</span>}
                    {p.note && <span className="block truncate text-foreground">{p.note[0].toUpperCase() + p.note.slice(1)}</span>}
                  </span>
                  <span className="text-right tabular-nums">{money(c.rate ?? 0)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {(plan.notes.length > 0 || plan.leftOut.length > 0 || plan.alternates.length > 0 || ask.dropped.length > 0) && (
        <ul className="grid gap-1 border-t px-4 py-2.5 text-[13px] text-pretty text-muted-foreground">
          {plan.notes.map((n) => <li key={n} className="text-foreground">{n}</li>)}
          {plan.leftOut.map((l) => <li key={l.id}>Left out: {l.name}. {l.why}</li>)}
          {plan.alternates.length > 0 && (
            <li>Fit the brief but are not signed, so have no rate: {plan.alternates.map((a) => a.creator.name).join(", ")}.</li>
          )}
          {ask.dropped.map((d) => <li key={d}>Not used: the model returned {d}, which is not written in the brief.</li>)}
        </ul>
      )}
    </section>
  );
}
