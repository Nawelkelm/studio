import { describe, expect, it } from "vitest";
import { emptyDraft, resolveFinalPrice, saveBlocker } from "./quote-draft";

describe("emptyDraft", () => {
  it("starts with a direct sale valid for 7 days and nothing typed", () => {
    const d = emptyDraft(new Date(2026, 9, 20, 12));
    expect(d).toEqual({
      clientName: "", clientContact: "", pieceName: "", pieceDescription: "", channel: "directo",
      finalPriceInput: null, validUntil: "2026-10-27", internalNotes: "",
    });
  });
});

describe("resolveFinalPrice", () => {
  it("uses the calculated price until the user types another one", () => {
    expect(resolveFinalPrice({ finalPriceInput: null }, 7050.456)).toBe(7050.46);
  });

  it("accepts es-AR style amounts (dot as thousands, comma as decimals) and plain numbers", () => {
    expect(resolveFinalPrice({ finalPriceInput: "6.500" }, 7050)).toBe(6500);
    expect(resolveFinalPrice({ finalPriceInput: "6500,50" }, 7050)).toBe(6500.5);
    expect(resolveFinalPrice({ finalPriceInput: "6500" }, 7050)).toBe(6500);
    expect(resolveFinalPrice({ finalPriceInput: "0" }, 7050)).toBe(0);
    expect(resolveFinalPrice({ finalPriceInput: "1.234.567,50" }, 7050)).toBe(1234567.5);
  });

  it("does not mistake a decimal dot for a thousands separator", () => {
    expect(resolveFinalPrice({ finalPriceInput: "6500.50" }, 7050)).toBe(6500.5);
    expect(resolveFinalPrice({ finalPriceInput: "6.5" }, 7050)).toBe(6.5);
  });

  it("returns null for empty, negative or non-numeric input", () => {
    for (const bad of ["", "  ", "abc", "-5", "12abc"]) {
      expect(resolveFinalPrice({ finalPriceInput: bad }, 7050)).toBeNull();
    }
  });
});

describe("saveBlocker", () => {
  const draft = { ...emptyDraft(), clientName: "Juan" };

  it("explains what is missing, in order of importance", () => {
    expect(saveBlocker(draft, false, 100)).toMatch(/peso y el tiempo/);
    expect(saveBlocker({ ...draft, clientName: "  " }, true, 100)).toMatch(/nombre del cliente/);
    expect(saveBlocker(draft, true, null)).toMatch(/monto válido/);
  });

  it("lets the user save once everything is in place", () => {
    expect(saveBlocker(draft, true, 100)).toBeNull();
    expect(saveBlocker(draft, true, 0)).toBeNull(); // charging nothing is allowed on purpose
  });
});
