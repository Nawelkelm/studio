"use client";

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { cn } from "@/lib/utils";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  label: string;
  /** Unit shown inside the input, on the right ("g", "min", "W"...) */
  suffix?: string;
  /** Currency or similar mark shown inside the input, on the left */
  prefix?: string;
  integer?: boolean;
  hint?: string;
  className?: string;
};

/** Numeric input with a unit, the right mobile keyboard and the form's validation message. */
export function NumberField<T extends FieldValues>({ form, name, label, suffix, prefix, integer, hint, className }: Props<T>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <div className="relative">
            {prefix && (
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {prefix}
              </span>
            )}
            <FormControl>
              <Input
                type="number"
                inputMode={integer ? "numeric" : "decimal"}
                step={integer ? 1 : "any"}
                min={0}
                className={cn("tabular-nums", prefix && "pl-7", suffix && "pr-12")}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            {suffix && (
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {suffix}
              </span>
            )}
          </div>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
