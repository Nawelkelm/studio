import { describe, expect, it } from "vitest";
import { prefillFromQuotation } from "./quote-prefill";
import { makeItem } from "./quotation-fixtures";

const NOW = new Date(2026, 9, 20, 12);

describe("prefillFromQuotation", () => {
  const q = makeItem({
    client_name: "María Fernández", client_contact: "11-5555-0000", piece_name: "Llavero dragón", piece_description: "PLA rojo",
    channel: "instagram", printer_id: "p-p1s", material_used: "PETG", print_weight_grams: 95.5, print_time_hours: 2,
    print_time_minutes: 30, quantity: 3, extra_costs: 200, profit_multiplier: 4, final_price: 25000, selling_price: 28000,
    internal_notes: "pidió descuento", created_at: "2026-09-01T12:00:00.000Z",
  });

  it("copies the piece, the client data and the channel", () => {
    const p = prefillFromQuotation(q, 7, NOW);
    expect(p.key).toBe(7);
    expect(p.printerId).toBe("p-p1s");
    expect(p.piece).toEqual({ materialUsed: "PETG", printWeightGrams: 95.5, printTimeHours: 2, printTimeMinutes: 30, quantity: 3, extraCosts: 200, profitMultiplier: 4 });
    expect(p.draft).toMatchObject({ clientName: "María Fernández", clientContact: "11-5555-0000", pieceName: "Llavero dragón", pieceDescription: "PLA rojo", channel: "instagram" });
  });

  it("starts fresh where the old data would mislead: validity, final price and notes", () => {
    const p = prefillFromQuotation(q, 1, NOW);
    expect(p.draft.validUntil).toBe("2026-10-27");
    expect(p.draft.finalPriceInput).toBeNull();
    expect(p.draft.internalNotes).toBe("");
  });

  it("remembers what the original was quoted at", () => {
    expect(prefillFromQuotation(q, 1, NOW).original).toEqual({ clientName: "María Fernández", createdAt: "2026-09-01T12:00:00.000Z", price: 25000 });
    expect(prefillFromQuotation({ ...q, final_price: null }, 1, NOW).original.price).toBe(28000);
  });

  it("sanitizes values that came from the database so the form accepts them", () => {
    const p = prefillFromQuotation(makeItem({ print_time_hours: 1.6 as number, print_time_minutes: 75, quantity: 0, profit_multiplier: 15, material_used: "", client_contact: null, piece_name: null }), 1, NOW);
    expect(p.piece).toMatchObject({ printTimeHours: 2, printTimeMinutes: 59, quantity: 1, profitMultiplier: 10, materialUsed: "PLA" });
    expect(p.draft).toMatchObject({ clientContact: "", pieceName: "" });
  });
});
