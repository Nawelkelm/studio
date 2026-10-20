import { defaultValidUntil, type Channel } from "@/lib/quotation-meta";

/** What the user types when saving a quotation (separate from the cost inputs). */
export type QuoteDraft = {
  clientName: string;
  clientContact: string;
  pieceName: string;
  pieceDescription: string;
  channel: Channel;
  /** Typed final price; null while the user accepts the calculated one */
  finalPriceInput: string | null;
  /** YYYY-MM-DD */
  validUntil: string;
  internalNotes: string;
};

export function emptyDraft(now: Date = new Date()): QuoteDraft {
  return {
    clientName: "",
    clientContact: "",
    pieceName: "",
    pieceDescription: "",
    channel: "directo",
    finalPriceInput: null,
    validUntil: defaultValidUntil(now),
    internalNotes: "",
  };
}

/** The price to charge: the typed one, or the calculated one. Null when what was typed is not a valid amount. */
export function resolveFinalPrice(draft: Pick<QuoteDraft, "finalPriceInput">, calculatedPrice: number): number | null {
  if (draft.finalPriceInput === null) return Math.round(calculatedPrice * 100) / 100;
  const typed = draft.finalPriceInput.trim();
  if (typed === "") return null;
  // "6.500" or "1.234.567,50" use the dot as thousands separator; "6500.50" and "6500,50" are plain decimals
  const text = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(typed) ? typed.replace(/\./g, "").replace(",", ".") : typed.replace(",", ".");
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}

/** Why saving is not possible yet, in the user's words (null when it is). */
export function saveBlocker(draft: QuoteDraft, hasResults: boolean, finalPrice: number | null): string | null {
  if (!hasResults) return "Completá el peso y el tiempo para calcular el precio.";
  if (!draft.clientName.trim()) return "Falta el nombre del cliente.";
  if (finalPrice === null) return "El precio final no es un monto válido.";
  return null;
}
