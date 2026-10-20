import { normalizeText, type QuotationView } from "@/lib/quotation-view";
import type { Channel, LostReason } from "@/lib/quotation-meta";

export type RankedRow = { key: string; label: string; count: number; value: number };
export type ChannelRow = { channel: Channel; total: number; approved: number; rejected: number; winRate: number | null; revenue: number };
export type ClientRow = { key: string; name: string; total: number; approved: number; revenue: number };
export type LostReasonRow = { reason: LostReason | "sin_motivo"; count: number };

export type Insights = {
  /** Approved + rejected quotations */
  decidedCount: number;
  /** Fewer than this many decided quotations: show the numbers with a "pocos datos" warning */
  hasEnoughData: boolean;
  /** Profit per printing hour of approved jobs, best first */
  perHourByMaterial: RankedRow[];
  perHourByPrinter: RankedRow[];
  channels: ChannelRow[];
  /** Top clients by approved revenue */
  topClients: ClientRow[];
  lostReasons: LostReasonRow[];
  /** Average discount of approved quotations against the calculated price (null without data) */
  averageDiscount: number | null;
  /** Share of approved quotations that were sold below the calculated price */
  discountedShare: number | null;
};

export const MIN_DECIDED_FOR_INSIGHTS = 5;

/** profit / hours per group, over approved jobs that have print time */
function perHour(views: QuotationView[], keyOf: (v: QuotationView) => string): RankedRow[] {
  const groups = new Map<string, { label: string; count: number; profit: number; hours: number }>();
  for (const v of views) {
    if (v.status !== "aprobada" || v.printHours <= 0) continue;
    const label = keyOf(v).trim();
    if (!label) continue;
    const key = normalizeText(label);
    const g = groups.get(key) ?? { label, count: 0, profit: 0, hours: 0 };
    g.count += 1; g.profit += v.profit; g.hours += v.printHours;
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, count: g.count, value: g.profit / g.hours }))
    .sort((a, b) => b.value - a.value);
}

export function buildInsights(views: QuotationView[]): Insights {
  const decided = views.filter((v) => v.status !== "pendiente");

  const channelMap = new Map<Channel, ChannelRow>();
  for (const v of views) {
    const row = channelMap.get(v.channel) ?? { channel: v.channel, total: 0, approved: 0, rejected: 0, winRate: null, revenue: 0 };
    row.total += 1;
    if (v.status === "aprobada") { row.approved += 1; row.revenue += v.price; }
    if (v.status === "rechazada") row.rejected += 1;
    channelMap.set(v.channel, row);
  }
  const channels = [...channelMap.values()]
    .map((c) => ({ ...c, winRate: c.approved + c.rejected > 0 ? c.approved / (c.approved + c.rejected) : null }))
    .sort((a, b) => b.revenue - a.revenue || b.total - a.total);

  const clientMap = new Map<string, ClientRow>();
  for (const v of views) {
    const key = normalizeText(v.client_name);
    if (!key) continue;
    const row = clientMap.get(key) ?? { key, name: v.client_name.trim(), total: 0, approved: 0, revenue: 0 };
    row.total += 1;
    if (v.status === "aprobada") { row.approved += 1; row.revenue += v.price; }
    clientMap.set(key, row);
  }
  const topClients = [...clientMap.values()]
    .filter((c) => c.approved > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const reasonMap = new Map<LostReasonRow["reason"], number>();
  for (const v of views) {
    if (v.status !== "rechazada") continue;
    const reason = v.lost_reason ?? "sin_motivo";
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
  }
  const lostReasons = [...reasonMap.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

  const approved = views.filter((v) => v.status === "aprobada");
  const averageDiscount = approved.length ? approved.reduce((sum, v) => sum + v.discount, 0) / approved.length : null;
  const discountedShare = approved.length ? approved.filter((v) => v.discount > 0.05).length / approved.length : null;

  return {
    decidedCount: decided.length,
    hasEnoughData: decided.length >= MIN_DECIDED_FOR_INSIGHTS,
    perHourByMaterial: perHour(views, (v) => v.material_used ?? ""),
    perHourByPrinter: perHour(views, (v) => v.printer_name ?? ""),
    channels,
    topClients,
    lostReasons,
    averageDiscount,
    discountedShare,
  };
}
