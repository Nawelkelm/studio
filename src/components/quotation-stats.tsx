"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Percent, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { summarizeQuotations, type StatsQuotation } from "@/lib/quotation-stats";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value || 0);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const APPROVED_COLOR = "hsl(142,70%,45%)";
const PENDING_COLOR = "hsl(252,78%,65%)";

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" /> {label}
        </div>
        <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function QuotationStats({ quotations }: { quotations: StatsQuotation[] }) {
  const summary = useMemo(() => summarizeQuotations(quotations), [quotations]);
  const { thisMonth, approvalRate, counts, months } = summary;
  const hasChartData = months.some((m) => m.approved > 0 || m.pending > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Cotizado este mes"
          value={formatCurrency(thisMonth.quoted)}
          hint={`${thisMonth.count} cotizacion${thisMonth.count === 1 ? "" : "es"} (sin rechazadas)`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Aprobado este mes"
          value={formatCurrency(thisMonth.approved)}
          hint="Ventas confirmadas"
        />
        <StatCard
          icon={TrendingUp}
          label="Ganancia aprobada este mes"
          value={formatCurrency(thisMonth.profit)}
          hint="Precio de venta menos costo"
        />
        <StatCard
          icon={Percent}
          label="Tasa de aprobación"
          value={approvalRate === null ? "—" : `${Math.round(approvalRate * 100)}%`}
          hint={`${counts.aprobada} aprobadas · ${counts.rechazada} rechazadas · ${counts.pendiente} pendientes`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Ventas por mes</CardTitle>
              <CardDescription>Últimos 6 meses, sin cotizaciones rechazadas.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,30%,22%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "hsl(0,0%,70%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v: number) => formatCompact(v)}
                  tick={{ fill: "hsl(0,0%,70%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
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
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Todavía no hay ventas aprobadas ni pendientes en los últimos 6 meses.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
