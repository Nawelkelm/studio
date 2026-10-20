import type { CalculationResults, CalculatorFormValues } from "@/lib/calculator";
import { marginPercent } from "@/lib/calculator";
import type { PricingRequest, PricingResponse, Strategy } from "@/lib/pricing-prompt";
import type { QuoteDraft } from "@/lib/quote-draft";

/** Builds the AI request from what is on the quoting screen. Null while there is nothing to ask about. */
export function buildAdvisorRequest(input: {
  values: CalculatorFormValues | null;
  results: CalculationResults | null;
  draft: QuoteDraft;
  strategy: Strategy;
}): PricingRequest | null {
  const { values, results, draft, strategy } = input;
  if (!values || !results) return null;
  return {
    pieceName: draft.pieceName.trim(),
    pieceDescription: draft.pieceDescription.trim() || undefined,
    materialUsed: values.materialUsed.trim() || "PLA",
    weightGrams: values.printWeightGrams,
    printTimeHours: values.printTimeHours + values.printTimeMinutes / 60,
    quantity: values.quantity,
    channel: draft.channel,
    strategy,
    costPerUnit: results.costPerUnit,
    currentPricePerUnit: results.sellingPricePerUnit,
    multiplier: values.profitMultiplier,
  };
}

/** Why the AI can't be asked yet, in the user's words (null when it can). */
export function advisorBlocker(draft: QuoteDraft, hasResults: boolean): string | null {
  if (!hasResults) return "Completá el peso y el tiempo para calcular tu costo.";
  if (draft.pieceName.trim().length < 2) return "Escribí qué pieza es para pedir la sugerencia.";
  return null;
}

export type SuggestionFetcher = (request: PricingRequest) => Promise<PricingResponse>;

/** Calls /api/suggest-pricing with the user's session. Throws an Error whose message is safe to show. */
export async function requestSuggestion(
  request: PricingRequest,
  getToken: () => Promise<string | null>,
  fetchImpl: typeof fetch = fetch,
): Promise<PricingResponse> {
  const token = await getToken();
  const res = await fetchImpl("/api/suggest-pricing", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(request),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : `Error del servidor (${res.status})`);
  if (!data || ![data.minimo, data.recomendado, data.premium].every((n) => typeof n === "number") || !Array.isArray(data.razones)) {
    throw new Error("La respuesta de la IA llegó incompleta. Probá de nuevo.");
  }
  return data as PricingResponse;
}

/** Margin of a suggested price and how far it is from the price currently on screen. */
export function tierMetrics(price: number, costPerUnit: number, currentPricePerUnit: number) {
  return {
    margin: marginPercent(price, costPerUnit),
    /** Percent above (+) or below (-) the current price */
    vsCurrent: currentPricePerUnit > 0 ? ((price - currentPricePerUnit) / currentPricePerUnit) * 100 : 0,
  };
}

// ---- price ladder geometry ---------------------------------------------------------------------------------------

export type LadderInput = { cost: number; minimo: number; recomendado: number; premium: number; current: number };

/** Maps prices to 0-100 positions on a scale that fits all of them with some air around. */
export function ladderScale(input: LadderInput): { lo: number; hi: number; position: (value: number) => number } {
  const values = [input.cost, input.minimo, input.recomendado, input.premium, input.current].filter((v) => Number.isFinite(v));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, high * 0.05, 1);
  const lo = Math.max(0, low - span * 0.12);
  const hi = high + span * 0.12;
  return { lo, hi, position: (value) => Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100)) };
}

/** Pushes labels apart so they don't overlap: each one stays at least `minGap` percent right of the previous. */
export function spreadLabels<T extends { position: number }>(items: T[], minGap = 20): (T & { left: number })[] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  let previous = -Infinity;
  return sorted.map((item) => {
    const left = Math.min(Math.max(item.position, previous + minGap), 100);
    previous = left;
    return { ...item, left };
  });
}
