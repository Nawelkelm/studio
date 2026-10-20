"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCompact, formatCurrencyWhole, formatPercent } from "@/lib/format";
import { summarizeQuotations, type StatsQuotation } from "@/lib/quotation-stats";

const APPROVED_COLOR = "hsl(142,70%,45%)";
const PENDING_COLOR = "hsl(252,78%,65%)";

/** One line with the month's numbers (no cards: this sits above the list). */
export function SummaryStrip({ quotations }: { quotations: StatsQuotation[] }) {
  const { thisMonth, approvalRate } = useMemo(() => summarizeQuotations(quotations), [quotations]);
  const items = [
    { label: "Cotizado este mes", value: formatCurrencyWhole(thisMonth.quoted), hint: `${thisMonth.count} cotizacion${thisMonth.count === 1 ? "" : "es"}, sin rechazadas` },
    { label: "Aprobado", value: formatCurrencyWhole(thisMonth.approved) },
    { label: "Ganancia aprobada", value: formatCurrencyWhole(thisMonth.profit) },
    { label: "Aprobación (total)", value: approvalRate === null ? "—" : formatPercent(approvalRate * 100) },
  ];
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border bg-card px-4 py-3">
      {items.map((item) => (
        <div key={item.label} title={item.hint}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Approved and pending sales of the last 6 months. */
export function MonthlySalesChart({ quotations }: { quotations: StatsQuotation[] }) {
  const { months } = useMemo(() => summarizeQuotations(quotations), [quotations]);
  const hasData = months.some((m) => m.approved > 0 || m.pending > 0);

  if (!hasData) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay ventas aprobadas ni pendientes en los últimos 6 meses.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,30%,22%)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "hsl(0,0%,70%)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fill: "hsl(0,0%,70%)", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip
          formatter={(value: number, name: string) => [formatCurrencyWhole(value), name]}
          cursor={{ fill: "hsl(252,30%,18%)" }}
          contentStyle={{ backgroundColor: "hsl(252,45%,13%)", border: "1px solid hsl(252,30%,22%)", borderRadius: "8px" }}
          itemStyle={{ color: "hsl(0,0%,98%)" }}
          labelStyle={{ color: "hsl(0,0%,98%)" }}
        />
        <Legend />
        <Bar dataKey="approved" name="Aprobadas" stackId="sales" fill={APPROVED_COLOR} />
        <Bar dataKey="pending" name="Pendientes" stackId="sales" fill={PENDING_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
