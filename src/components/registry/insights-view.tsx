"use client";

import { useMemo, type ReactNode } from "react";
import { Info } from "lucide-react";

import { formatCurrencyWhole, formatPercent } from "@/lib/format";
import { buildInsights, MIN_DECIDED_FOR_INSIGHTS, type RankedRow } from "@/lib/quotation-insights";
import { channelLabel, lostReasonLabel } from "@/lib/quotation-meta";
import type { QuotationView } from "@/lib/quotation-view";
import { MonthlySalesChart } from "@/components/quotation-stats";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Label, a bar proportional to `value / max` and the figure. */
function BarRow({ label, value, max, display, note }: { label: string; value: number; max: number; display: string; note?: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate">{label}{note && <span className="ml-2 text-xs text-muted-foreground">{note}</span>}</span>
        <span className="shrink-0 font-medium tabular-nums">{display}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

function PerHourList({ title, rows }: { title: string; rows: RankedRow[] }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin ventas aprobadas con tiempo de impresión.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <BarRow key={r.key} label={r.label} value={r.value} max={max} display={`${formatCurrencyWhole(r.value)}/h`} note={`${r.count} venta${r.count === 1 ? "" : "s"}`} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function InsightsView({ views }: { views: QuotationView[] }) {
  const insights = useMemo(() => buildInsights(views), [views]);
  const statsInput = useMemo(
    () => views.map((v) => ({ status: v.status, total_cost: v.total_cost, selling_price: v.price, created_at: v.created_at })),
    [views],
  );
  const maxReason = Math.max(0, ...insights.lostReasons.map((r) => r.count));
  const maxClient = Math.max(0, ...insights.topClients.map((c) => c.revenue));

  return (
    <div className="space-y-8">
      {!insights.hasEnoughData && (
        <p role="note" className="flex items-start gap-2 rounded-md bg-secondary/60 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          Todavía hay pocos datos: con {MIN_DECIDED_FOR_INSIGHTS} o más cotizaciones aprobadas o rechazadas ({insights.decidedCount} por ahora)
          los promedios son más confiables.
        </p>
      )}

      <Section title="Ventas por mes" hint="Últimos 6 meses, a precio final y sin cotizaciones rechazadas.">
        <MonthlySalesChart quotations={statsInput} />
      </Section>

      <Section title="Ganancia por hora de impresión" hint="Solo ventas aprobadas. Sirve para decidir qué trabajos conviene aceptar.">
        <div className="grid gap-6 md:grid-cols-2">
          <PerHourList title="Por material" rows={insights.perHourByMaterial} />
          <PerHourList title="Por impresora" rows={insights.perHourByPrinter} />
        </div>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Canales" hint="Conversión = aprobadas sobre las ya decididas.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Canal</th>
                  <th className="pb-2 text-right font-medium">Cotiz.</th>
                  <th className="pb-2 text-right font-medium">Conversión</th>
                  <th className="pb-2 text-right font-medium">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {insights.channels.map((c) => (
                  <tr key={c.channel} className="border-t">
                    <td className="py-2">{channelLabel(c.channel)}</td>
                    <td className="py-2 text-right">{c.total}</td>
                    <td className="py-2 text-right">{c.winRate === null ? "—" : formatPercent(c.winRate * 100)}</td>
                    <td className="py-2 text-right">{formatCurrencyWhole(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Mejores clientes" hint="Por ventas aprobadas.">
          {insights.topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay ventas aprobadas.</p>
          ) : (
            <ul className="space-y-2.5">
              {insights.topClients.map((c) => (
                <BarRow
                  key={c.key}
                  label={c.name}
                  value={c.revenue}
                  max={maxClient}
                  display={formatCurrencyWhole(c.revenue)}
                  note={c.total > 1 ? `${c.total} cotizaciones · recurrente` : "1 cotización"}
                />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Por qué se pierden ventas" hint="Motivos de las cotizaciones rechazadas.">
          {insights.lostReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay cotizaciones rechazadas.</p>
          ) : (
            <ul className="space-y-2.5">
              {insights.lostReasons.map((r) => (
                <BarRow
                  key={r.reason}
                  label={r.reason === "sin_motivo" ? "Sin motivo registrado" : lostReasonLabel(r.reason)}
                  value={r.count}
                  max={maxReason}
                  display={String(r.count)}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Precios" hint="Precio final cobrado frente al calculado, en ventas aprobadas.">
          {insights.averageDiscount === null ? (
            <p className="text-sm text-muted-foreground">Todavía no hay ventas aprobadas.</p>
          ) : (
            <p className="text-sm leading-relaxed">
              {insights.averageDiscount > 0.05 ? (
                <>En promedio cobraste <strong className="tabular-nums">{formatPercent(insights.averageDiscount)}</strong> menos que el precio calculado</>
              ) : (
                <>En promedio cobraste el precio calculado</>
              )}
              {insights.discountedShare !== null && (
                <>; <strong className="tabular-nums">{formatPercent(insights.discountedShare * 100)}</strong> de las ventas llevaron descuento.</>
              )}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
