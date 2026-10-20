"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { CloudUpload, Loader2, Pencil, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrencyWhole } from "@/lib/format";
import type { CalculatorFormValues } from "@/lib/calculator";
import type { Printer } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberField } from "@/components/quote/number-field";

type Props = {
  form: UseFormReturn<CalculatorFormValues>;
  printers: Printer[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Number of preset values that differ from the saved ones */
  changedCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

const num = (n: number) => new Intl.NumberFormat("es-AR").format(n);

/**
 * Printer choice plus its shared cost values. The values are shared by the whole team, so editing is
 * deliberate: nothing is saved until "Guardar para todo el equipo".
 */
export function PrinterStrip({ form, printers, loading, selectedId, onSelect, changedCount, saving, onSave, onDiscard }: Props) {
  const [editing, setEditing] = useState(false);
  const selected = printers.find((p) => p.id === selectedId);
  const dirty = changedCount > 0;

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (printers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No hay impresoras cargadas. Pedile a un administrador que agregue una en Supabase para poder cotizar.
      </p>
    );
  }

  return (
    <section aria-labelledby="printer-heading" className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="printer-heading" className="text-sm font-semibold">Impresora</h2>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          <Pencil className="h-3.5 w-3.5" /> {editing ? "Cerrar" : "Editar valores"}
        </Button>
      </div>

      <div role="radiogroup" aria-labelledby="printer-heading" className="flex flex-wrap gap-2">
        {printers.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === selectedId}
            onClick={() => onSelect(p.id)}
            className={cn(
              "min-h-11 rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              p.id === selectedId ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {selected && !editing && (
        <p className="text-xs text-muted-foreground tabular-nums leading-relaxed">
          {num(selected.printer_power)} W · máquina {formatCurrencyWhole(selected.printer_cost)} · vida útil {num(selected.printer_lifespan)} h ·
          fallos {num(selected.failure_rate_percent)}% · filamento {formatCurrencyWhole(selected.filament_cost_per_kg)}/kg · luz {formatCurrencyWhole(selected.electricity_cost_kwh)}/kWh
        </p>
      )}

      {editing && (
        <div className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumberField form={form} name="filamentCostPerKg" label="Filamento" prefix="$" suffix="/kg" />
            <NumberField form={form} name="electricityCostKwh" label="Electricidad" prefix="$" suffix="/kWh" />
            <NumberField form={form} name="printerPower" label="Consumo" suffix="W" />
            <NumberField form={form} name="printerCost" label="Costo de la máquina" prefix="$" />
            <NumberField form={form} name="printerLifespan" label="Vida útil" suffix="h" />
            <NumberField form={form} name="failureRatePercent" label="Tasa de fallos" suffix="%" />
          </div>
          <p className="text-xs text-muted-foreground">
            Estos valores se comparten con todo el equipo. Podés probarlos acá y ver el precio; se guardan solo si tocás el botón.
          </p>
        </div>
      )}

      {dirty && (
        <div role="status" className="flex flex-col gap-2 rounded-md bg-yellow-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Estás usando {changedCount === 1 ? "1 valor distinto" : `${changedCount} valores distintos`} a los guardados de {selected?.name}.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
              Guardar para todo el equipo
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDiscard} disabled={saving} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Volver a los guardados
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
