import type { Quotation } from "@/lib/supabase";

export type StatsQuotation = Pick<Quotation, "status" | "total_cost" | "selling_price" | "created_at">;

export type MonthStats = {
  /** YYYY-MM in the browser's local time */
  key: string;
  label: string;
  /** Selling price of approved quotations */
  approved: number;
  /** Selling price of pending quotations */
  pending: number;
  /** selling price - cost of approved quotations */
  profit: number;
  count: number;
};

export type QuotationSummary = {
  thisMonth: { count: number; quoted: number; approved: number; profit: number };
  /** approved / (approved + rejected) over all quotations; null until one is decided */
  approvalRate: number | null;
  counts: Record<Quotation["status"], number>;
  /** Last N months, oldest first, zero-filled */
  months: MonthStats[];
};

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit" }).format(date).replace(".", "");

export function summarizeQuotations(
  quotations: StatsQuotation[],
  now: Date = new Date(),
  monthsBack = 6,
): QuotationSummary {
  const months: MonthStats[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: monthLabel(d), approved: 0, pending: 0, profit: 0, count: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  const currentKey = monthKey(now);

  const counts: QuotationSummary["counts"] = { pendiente: 0, aprobada: 0, rechazada: 0 };
  const thisMonth = { count: 0, quoted: 0, approved: 0, profit: 0 };

  for (const q of quotations) {
    if (q.status in counts) counts[q.status] += 1;

    const created = new Date(q.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const price = toNumber(q.selling_price);
    const profit = price - toNumber(q.total_cost);
    const key = monthKey(created);

    const month = byKey.get(key);
    if (month) {
      month.count += 1;
      if (q.status === "aprobada") { month.approved += price; month.profit += profit; }
      if (q.status === "pendiente") month.pending += price;
    }

    if (key === currentKey) {
      thisMonth.count += 1;
      if (q.status !== "rechazada") thisMonth.quoted += price;
      if (q.status === "aprobada") { thisMonth.approved += price; thisMonth.profit += profit; }
    }
  }

  const decided = counts.aprobada + counts.rechazada;
  return { thisMonth, approvalRate: decided > 0 ? counts.aprobada / decided : null, counts, months };
}
