import type { CalculatorFormValues } from "@/lib/calculator";
import { effectivePrice } from "@/lib/quotation-meta";
import { emptyDraft, type QuoteDraft } from "@/lib/quote-draft";
import type { QuotationListItem } from "@/lib/quotation-view";

/** Everything needed to start a new quotation from an existing one. */
export type QuotePrefill = {
  /** Increments per request so the same quotation can be duplicated twice in a row */
  key: number;
  printerId: string | null;
  /** The piece's data. The printer's costs are NOT copied: the new price uses today's saved values. */
  piece: Pick<CalculatorFormValues, "materialUsed" | "printWeightGrams" | "printTimeHours" | "printTimeMinutes" | "quantity" | "extraCosts" | "profitMultiplier">;
  draft: Partial<QuoteDraft>;
  /** What the original quotation was quoted at, to compare with the new price */
  original: { clientName: string; createdAt: string; price: number };
};

const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function prefillFromQuotation(q: QuotationListItem, key: number, now: Date = new Date()): QuotePrefill {
  return {
    key,
    printerId: q.printer_id,
    piece: {
      materialUsed: q.material_used || "PLA",
      printWeightGrams: num(q.print_weight_grams),
      printTimeHours: Math.round(num(q.print_time_hours)),
      printTimeMinutes: Math.min(59, Math.round(num(q.print_time_minutes))),
      quantity: Math.max(1, Math.round(num(q.quantity, 1))),
      extraCosts: num(q.extra_costs),
      profitMultiplier: Math.min(10, Math.max(1, num(q.profit_multiplier, 5))),
    },
    draft: {
      ...emptyDraft(now), // fresh validity date, no final-price override, empty notes
      clientName: q.client_name,
      clientContact: q.client_contact ?? "",
      pieceName: q.piece_name ?? "",
      pieceDescription: q.piece_description ?? "",
      channel: q.channel,
    },
    original: { clientName: q.client_name, createdAt: q.created_at, price: num(effectivePrice(q)) },
  };
}
