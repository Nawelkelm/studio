"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyWhole, formatPercent } from "@/lib/format";
import {
  MERCADOLIBRE_FEE_RATE, marginPercent, multiplierForPrice, profitPerHour, type CalculationResults,
} from "@/lib/calculator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { value: 3, label: "Mayorista" },
  { value: 4, label: "Minorista" },
  { value: 5, label: "Premium" },
];

const CHART_COLORS = ["hsl(252,78%,65%)", "hsl(240,60%,50%)", "hsl(268,80%,58%)", "hsl(278,65%,62%)", "hsl(200,70%,55%)"];

type Props = {
  /** null while the inputs are incomplete */
  results: CalculationResults | null;
  multiplier: number;
  printTimeHours: number;
  printTimeMinutes: number;
  onMultiplierChange: (value: number) => void;
};

export function PricePanel({ results, multiplier, printTimeHours, printTimeMinutes, onMultiplierChange }: Props) {
  if (!results) {
    return (
      <section aria-labelledby="price-heading" className="space-y-2 py-2">
        <h2 id="price-heading" className="text-sm font-semibold">Precio de venta</h2>
        <p className="text-4xl font-bold tabular-nums text-muted-foreground/40" aria-hidden>$ —</p>
        <p className="text-sm text-muted-foreground">Completá el peso y el tiempo de impresión y el precio aparece acá, en vivo.</p>
      </section>
    );
  }

  const margin = marginPercent(results.sellingPrice, results.totalCostWithSupplies);
  const perHour = profitPerHour(results.profitAmount, printTimeHours, printTimeMinutes, results.quantity);

  return (
    <section aria-labelledby="price-heading" className="space-y-5">
      <div>
        <h2 id="price-heading" className="text-sm font-semibold text-muted-foreground">Precio de venta</h2>
        <p className="text-4xl font-bold tabular-nums tracking-tight" aria-live="polite" aria-atomic="true">
          {formatCurrencyWhole(results.sellingPrice)}
        </p>
        {results.quantity > 1 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatCurrencyWhole(results.sellingPricePerUnit)} por unidad × {results.quantity}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3 border-y py-3">
        <Metric label="Margen" value={formatPercent(margin)} tone={margin <= 0 ? "bad" : "good"} />
        <Metric label="Ganancia" value={formatCurrencyWhole(results.profitAmount)} tone={results.profitAmount <= 0 ? "bad" : "good"} />
        <Metric label="Por hora" value={perHour === null ? "—" : `${formatCurrencyWhole(perHour)}/h`} hint="Ganancia por hora de impresión" />
      </dl>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium" id="multiplier-label">Multiplicador</span>
          <span className="text-sm tabular-nums text-muted-foreground">x{String(multiplier).replace(".", ",")}</span>
        </div>
        <div role="group" aria-labelledby="multiplier-label" className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={multiplier === p.value}
              onClick={() => onMultiplierChange(p.value)}
              className={cn(
                "min-h-11 rounded-md border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                multiplier === p.value ? "border-primary bg-primary/15 font-semibold" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <span className="block tabular-nums">x{p.value}</span>
              <span className="block text-[11px] font-normal opacity-80">{p.label}</span>
            </button>
          ))}
        </div>
        <PriceInput pricePerUnit={results.sellingPricePerUnit} costPerUnit={results.costPerUnit} onMultiplierChange={onMultiplierChange} />
        {multiplier <= 1 && <p className="text-xs text-red-400">Sin ganancia: el precio es igual al costo.</p>}
      </div>

      <p className="text-sm text-muted-foreground tabular-nums">
        En MercadoLibre (comisión {Math.round(MERCADOLIBRE_FEE_RATE * 100)}%):{" "}
        <span className="font-medium text-yellow-400">{formatCurrencyWhole(results.mercadoLibrePrice)}</span>
        <span className="block text-xs">Así te quedan {formatCurrencyWhole(results.sellingPrice)} netos.</span>
      </p>

      <Breakdown results={results} />
    </section>
  );
}

function Metric({ label, value, tone, hint }: { label: string; value: string; tone?: "good" | "bad"; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground" title={hint}>{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", tone === "good" && "text-green-400", tone === "bad" && "text-red-400")}>{value}</dd>
    </div>
  );
}

/** Price per unit that can be typed: it back-solves the multiplier ("quiero cobrar $X"). */
function PriceInput({ pricePerUnit, costPerUnit, onMultiplierChange }: { pricePerUnit: number; costPerUnit: number; onMultiplierChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="price-per-unit" className="text-xs text-muted-foreground">Quiero cobrar por unidad</Label>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          id="price-per-unit"
          inputMode="decimal"
          className="pl-7 tabular-nums"
          value={draft ?? String(Math.round(pricePerUnit))}
          onFocus={() => setDraft(String(Math.round(pricePerUnit)))}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            setDraft(e.target.value);
            const typed = Number(e.target.value.replace(",", "."));
            const next = typed > 0 ? multiplierForPrice(typed, costPerUnit) : null;
            if (next !== null) onMultiplierChange(next);
          }}
        />
      </div>
    </div>
  );
}

function Breakdown({ results }: { results: CalculationResults }) {
  const rows = [
    { name: "Material", value: results.materialCost },
    { name: "Electricidad", value: results.electricityCost },
    { name: "Amortización", value: results.depreciationCost },
    { name: "Margen de error", value: results.errorMarginCost },
    { name: "Adicionales", value: results.suppliesCost },
  ];
  const chartData = rows.filter((r) => r.value > 0);

  return (
    <Collapsible className="border-t pt-3">
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Desglose de costos
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <dl className="space-y-1.5 text-sm tabular-nums">
          {rows.map((r) => (
            <div key={r.name} className="flex justify-between">
              <dt className="text-muted-foreground">{r.name}</dt>
              <dd>{formatCurrency(r.value)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1.5 font-semibold">
            <dt>Costo total</dt>
            <dd>{formatCurrency(results.totalCostWithSupplies)}</dd>
          </div>
        </dl>
        {chartData.length > 0 && (
          <div className="h-48" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ backgroundColor: "hsl(252,45%,13%)", border: "1px solid hsl(252,30%,22%)", borderRadius: "8px" }}
                  itemStyle={{ color: "hsl(0,0%,98%)" }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
