"use client";

import type { UseFormReturn } from "react-hook-form";
import { Eraser } from "lucide-react";

import type { CalculatorFormValues } from "@/lib/calculator";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/quote/number-field";

const MATERIALS = ["PLA", "PETG", "ABS", "ASA", "TPU", "Nylon", "Resina"];

type Props = {
  form: UseFormReturn<CalculatorFormValues>;
  onClear: () => void;
};

/** The data of this particular job: what is being printed, how long it takes and how many are wanted. */
export function PieceFields({ form, onClear }: Props) {
  return (
    <section aria-labelledby="piece-heading" className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="piece-heading" className="text-sm font-semibold">Pieza</h2>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={onClear}>
          <Eraser className="h-3.5 w-3.5" /> Limpiar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberField form={form} name="printWeightGrams" label="Peso" suffix="g" />
        <NumberField form={form} name="quantity" label="Cantidad" integer suffix="u." />

        <fieldset className="col-span-2 grid grid-cols-2 gap-4">
          <legend className="mb-2 text-sm font-medium">Tiempo de impresión</legend>
          <NumberField form={form} name="printTimeHours" label="Horas" integer suffix="h" />
          <NumberField form={form} name="printTimeMinutes" label="Minutos" integer suffix="min" />
        </fieldset>

        <FormField
          control={form.control}
          name="materialUsed"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Material</FormLabel>
              <FormControl>
                <Input list="material-options" autoComplete="off" {...field} />
              </FormControl>
              <datalist id="material-options">
                {MATERIALS.map((m) => <option key={m} value={m} />)}
              </datalist>
              <FormMessage />
            </FormItem>
          )}
        />
        <NumberField form={form} name="extraCosts" label="Costos adicionales" prefix="$" hint="Pintura, pegamento, packaging" />
      </div>
    </section>
  );
}
