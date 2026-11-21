"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** One choice out of a few, as a compact row of buttons. Used for every sort control. */
export function Segmented<T extends string>({ label, value, options, onChange, className }: {
  label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (next: T) => void; className?: string;
}) {
  return (
    <ToggleGroup
      aria-label={label} value={[value]} spacing={0}
      onValueChange={(v) => { if (v[0]) onChange(v[0] as T); }}
      className={cn("rounded-lg border bg-card p-0.5", className)}
    >
      {options.map(([key, text]) => (
        <ToggleGroupItem
          key={key} value={key}
          className="h-6 rounded-md! px-2.5 text-[13px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {text}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
