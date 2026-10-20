import type { CalculationResults, CalculatorFormValues } from "@/lib/calculator";
import type { Quotation } from "@/lib/supabase";

export type Channel = Quotation["channel"];
export type LostReason = NonNullable<Quotation["lost_reason"]>;

export const CHANNELS: { value: Channel; label: string }[] = [
  { value: "directo", label: "Directo" },
  { value: "mercadolibre", label: "MercadoLibre" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "otro", label: "Otro" },
];

export const LOST_REASONS: { value: LostReason; label: string }[] = [
  { value: "caro", label: "Caro" },
  { value: "tardanza", label: "Tardó la respuesta" },
  { value: "arrepentimiento", label: "Se arrepintió" },
  { value: "competencia", label: "Compró en otro lado" },
  { value: "sin_respuesta", label: "Sin respuesta" },
  { value: "otro", label: "Otro" },
];

export const channelLabel = (value: string) => CHANNELS.find((c) => c.value === value)?.label ?? value;
export const lostReasonLabel = (value: string) => LOST_REASONS.find((r) => r.value === value)?.label ?? value;

export const DEFAULT_VALIDITY_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD in the browser's local time, `days` after `from`. */
export function defaultValidUntil(from: Date = new Date(), days: number = DEFAULT_VALIDITY_DAYS): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "19/10/2026" from a YYYY-MM-DD date (no timezone shifts). */
export function formatDateOnly(value: string): string {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

/** Discount of the final price against the calculated one, in percent (negative = charging more). */
export function discountPercent(calculatedPrice: number, finalPrice: number): number {
  return calculatedPrice > 0 ? ((calculatedPrice - finalPrice) / calculatedPrice) * 100 : 0;
}

/** Price actually quoted: the final price, or the calculated one for quotations made before final_price existed. */
export const effectivePrice = (q: Pick<Quotation, "final_price" | "selling_price">) => q.final_price ?? q.selling_price;

/** Everything needed to understand later how a quotation's numbers were produced, even if printer values change. */
export type QuotationSnapshot = {
  v: 1;
  inputs: CalculatorFormValues;
  results: CalculationResults;
  printer: { id: string | null; name: string };
};

export function buildSnapshot(
  inputs: CalculatorFormValues,
  results: CalculationResults,
  printer: { id: string | null; name: string },
): QuotationSnapshot {
  return { v: 1, inputs, results, printer };
}
