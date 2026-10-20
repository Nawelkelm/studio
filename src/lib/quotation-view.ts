import { marginPercent } from "@/lib/calculator";
import { channelLabel, discountPercent, effectivePrice, lostReasonLabel, type Channel } from "@/lib/quotation-meta";
import type { Quotation } from "@/lib/supabase";

/** What the list loads: everything except the heavy/legacy columns. */
export type QuotationListItem = Omit<Quotation, "snapshot" | "notes">;

/** The fields users may change after a quotation was created (matches the column grants in the database). */
export type QuotationEdit = Partial<Pick<Quotation, "piece_name" | "piece_description" | "client_contact" | "channel" | "final_price" | "valid_until" | "internal_notes">>;

/** A quotation plus the numbers every screen needs, computed once. */
export type QuotationView = QuotationListItem & {
  /** Price actually quoted (final price, or the calculated one for old rows) */
  price: number;
  profit: number;
  /** Profit over price, in percent */
  margin: number;
  /** Printing hours of the whole batch */
  printHours: number;
  /** null when the print time is zero */
  profitPerHour: number | null;
  /** Discount of the final price against the calculated one, in percent (negative = charged more) */
  discount: number;
  /** Still pending after its validity date */
  isExpired: boolean;
};

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function toView(q: QuotationListItem, now: Date = new Date()): QuotationView {
  const price = num(effectivePrice(q));
  const cost = num(q.total_cost);
  const profit = price - cost;
  const printHours = (num(q.print_time_hours) + num(q.print_time_minutes) / 60) * Math.max(1, num(q.quantity));
  return {
    ...q,
    price,
    profit,
    margin: marginPercent(price, cost),
    printHours,
    profitPerHour: printHours > 0 ? profit / printHours : null,
    discount: discountPercent(num(q.selling_price), price),
    isExpired: q.status === "pendiente" && !!q.valid_until && q.valid_until < localDate(now),
  };
}

/** Lowercase and without accents, for forgiving searches ("maria" finds "María"). */
export const normalizeText = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export type Period = "all" | "month" | "30d" | "90d";
export type StatusFilter = "todas" | Quotation["status"];

export type ViewFilters = {
  search: string;
  status: StatusFilter;
  channel: "todos" | Channel;
  /** Printer name, or "todas" */
  printer: string;
  period: Period;
};

export const DEFAULT_FILTERS: ViewFilters = { search: "", status: "todas", channel: "todos", printer: "todas", period: "all" };

const DAY_MS = 24 * 60 * 60 * 1000;

function inPeriod(createdAt: string, period: Period, now: Date): boolean {
  if (period === "all") return true;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  if (period === "month") return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  return now.getTime() - created.getTime() <= (period === "30d" ? 30 : 90) * DAY_MS;
}

/** Applies every filter except the status one (used to count quotations per status). */
export function filterWithoutStatus(views: QuotationView[], filters: ViewFilters, now: Date = new Date()): QuotationView[] {
  const search = normalizeText(filters.search);
  return views.filter((v) => {
    if (filters.channel !== "todos" && v.channel !== filters.channel) return false;
    if (filters.printer !== "todas" && v.printer_name !== filters.printer) return false;
    if (!inPeriod(v.created_at, filters.period, now)) return false;
    if (!search) return true;
    return [v.client_name, v.piece_name, v.client_contact, v.material_used, v.printer_name]
      .some((field) => field && normalizeText(field).includes(search));
  });
}

export function filterViews(views: QuotationView[], filters: ViewFilters, now: Date = new Date()): QuotationView[] {
  const base = filterWithoutStatus(views, filters, now);
  return filters.status === "todas" ? base : base.filter((v) => v.status === filters.status);
}

export function countByStatus(views: QuotationView[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { todas: views.length, pendiente: 0, aprobada: 0, rechazada: 0 };
  for (const v of views) counts[v.status] += 1;
  return counts;
}

export type SortKey = "recent" | "price" | "margin" | "perHour";

export const SORT_LABELS: Record<SortKey, string> = {
  recent: "Más recientes",
  price: "Mayor precio",
  margin: "Mayor margen",
  perHour: "Mejor ganancia por hora",
};

export function sortViews(views: QuotationView[], key: SortKey): QuotationView[] {
  const byDate = (a: QuotationView, b: QuotationView) => b.created_at.localeCompare(a.created_at);
  const metric: Record<Exclude<SortKey, "recent">, (v: QuotationView) => number> = {
    price: (v) => v.price,
    margin: (v) => v.margin,
    perHour: (v) => v.profitPerHour ?? -Infinity, // without print time they go last
  };
  return [...views].sort((a, b) => (key === "recent" ? byDate(a, b) : metric[key](b) - metric[key](a) || byDate(a, b)));
}

/** Distinct printer names present in the data, alphabetically. */
export const printerNames = (views: QuotationView[]) =>
  [...new Set(views.map((v) => v.printer_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

// ---- CSV export (opens in Excel with es-AR settings: ";" separator, decimal comma) -----------------------------

const csvText = (value: string | null | undefined) => `"${(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const csvNumber = (value: number | null) => (value === null || !Number.isFinite(value) ? "" : value.toFixed(2).replace(".", ","));
const csvDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR") : "");

const CSV_HEADER = [
  "Fecha", "Cliente", "Contacto", "Pieza", "Canal", "Impresora", "Material", "Cantidad", "Costo", "Precio calculado",
  "Precio final", "Descuento %", "Margen %", "Ganancia", "Ganancia por hora", "Estado", "Motivo de rechazo",
  "Fecha de decisión", "Vigencia", "Responsable", "Notas internas",
];

export function quotationsToCsv(views: QuotationView[]): string {
  const rows = views.map((v) =>
    [
      csvDate(v.created_at), csvText(v.client_name), csvText(v.client_contact), csvText(v.piece_name),
      csvText(channelLabel(v.channel)), csvText(v.printer_name), csvText(v.material_used), String(v.quantity),
      csvNumber(num(v.total_cost)), csvNumber(num(v.selling_price)), csvNumber(v.price), csvNumber(v.discount),
      csvNumber(v.margin), csvNumber(v.profit), csvNumber(v.profitPerHour), csvText(v.status),
      csvText(v.lost_reason ? lostReasonLabel(v.lost_reason) : ""), csvDate(v.decided_at),
      v.valid_until ? v.valid_until.split("-").reverse().join("/") : "", csvText(v.user_name), csvText(v.internal_notes),
    ].join(";"),
  );
  // BOM so Excel reads the accents correctly
  return `﻿${[CSV_HEADER.join(";"), ...rows].join("\r\n")}\r\n`;
}
