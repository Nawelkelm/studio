import { describe, expect, it } from "vitest";
import {
  CHANNELS, LOST_REASONS, buildSnapshot, channelLabel, defaultValidUntil, discountPercent, effectivePrice,
  formatDateOnly, lostReasonLabel,
} from "./quotation-meta";
import { calculateResults, type CalculatorFormValues } from "./calculator";

const inputs: CalculatorFormValues = {
  filamentCostPerKg: 20000, materialUsed: "PLA", electricityCostKwh: 100, printerPower: 200, printerLifespan: 5000,
  printerCost: 100000, failureRatePercent: 10, printTimeHours: 2, printTimeMinutes: 30, printWeightGrams: 100,
  extraCosts: 40, profitMultiplier: 3, quantity: 1,
};

describe("labels", () => {
  it("labels every channel and lost reason the database accepts", () => {
    expect(CHANNELS.map((c) => c.value)).toEqual(["directo", "mercadolibre", "instagram", "whatsapp", "otro"]);
    expect(LOST_REASONS.map((r) => r.value)).toEqual(["caro", "tardanza", "arrepentimiento", "competencia", "sin_respuesta", "otro"]);
    expect(channelLabel("mercadolibre")).toBe("MercadoLibre");
    expect(lostReasonLabel("competencia")).toBe("Compró en otro lado");
  });

  it("falls back to the raw value for unknown codes", () => {
    expect(channelLabel("telegram")).toBe("telegram");
    expect(lostReasonLabel("x")).toBe("x");
  });
});

describe("dates", () => {
  it("adds the validity days in local time, crossing months and years", () => {
    expect(defaultValidUntil(new Date(2026, 9, 20, 15), 7)).toBe("2026-10-27");
    expect(defaultValidUntil(new Date(2026, 9, 28, 23, 59), 7)).toBe("2026-11-04");
    expect(defaultValidUntil(new Date(2026, 11, 29), 7)).toBe("2027-01-05");
  });

  it("formats a date-only value without timezone shifts", () => {
    expect(formatDateOnly("2026-11-04")).toBe("04/11/2026");
    expect(formatDateOnly("garbage")).toBe("garbage");
  });
});

describe("prices", () => {
  it("computes the discount against the calculated price (negative when charging more)", () => {
    expect(discountPercent(10000, 9000)).toBeCloseTo(10);
    expect(discountPercent(10000, 10000)).toBe(0);
    expect(discountPercent(10000, 11000)).toBeCloseTo(-10);
    expect(discountPercent(0, 500)).toBe(0);
  });

  it("uses the final price, or the calculated one for old quotations", () => {
    expect(effectivePrice({ final_price: 8500, selling_price: 9000 })).toBe(8500);
    expect(effectivePrice({ final_price: null, selling_price: 9000 })).toBe(9000);
    expect(effectivePrice({ final_price: 0, selling_price: 9000 })).toBe(0); // a deliberate zero is not "missing"
  });
});

describe("buildSnapshot", () => {
  it("keeps the inputs, results and printer so the numbers can be explained later", () => {
    const results = calculateResults(inputs);
    const snapshot = buildSnapshot(inputs, results, { id: "p1", name: "Bambu Lab A1" });
    expect(snapshot).toEqual({ v: 1, inputs, results, printer: { id: "p1", name: "Bambu Lab A1" } });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot); // safe to store as jsonb
  });
});
