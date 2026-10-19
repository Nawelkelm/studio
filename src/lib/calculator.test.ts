import { describe, expect, it } from "vitest";
import {
  calculateResults,
  calculatorSchema,
  getPresetUpdates,
  isPresetField,
  MERCADOLIBRE_FEE_RATE,
  type CalculatorFormValues,
} from "./calculator";
import type { Printer } from "./supabase";

const baseValues: CalculatorFormValues = {
  filamentCostPerKg: 20000,
  materialUsed: "PLA",
  electricityCostKwh: 100,
  printerPower: 200,
  printerLifespan: 5000,
  printerCost: 100000,
  failureRatePercent: 10,
  printTimeHours: 2,
  printTimeMinutes: 30,
  printWeightGrams: 100,
  extraCosts: 40,
  profitMultiplier: 3,
  quantity: 1,
};

const printer: Printer = {
  id: "printer-1",
  name: "Ender 3",
  filament_cost_per_kg: 15000,
  electricity_cost_kwh: 140,
  printer_power: 120,
  printer_lifespan: 4320,
  printer_cost: 150000,
  failure_rate_percent: 30,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("calculateResults", () => {
  it("computes every cost component for a single unit", () => {
    const r = calculateResults(baseValues);
    expect(r.materialCost).toBeCloseTo(2000); // 20000/kg * 100 g
    expect(r.electricityCost).toBeCloseTo(50); // 0.2 kW * 2.5 h * 100
    expect(r.depreciationCost).toBeCloseTo(50); // 100000/5000 * 2.5 h
    expect(r.errorMarginCost).toBeCloseTo(210); // 10% of (2000 + 50 + 50)
    expect(r.suppliesCost).toBe(40);
    expect(r.totalCostWithSupplies).toBeCloseTo(2350);
    expect(r.sellingPrice).toBeCloseTo(7050); // x3
    expect(r.profitAmount).toBeCloseTo(4700);
  });

  it("scales totals by quantity but keeps per-unit values", () => {
    const one = calculateResults(baseValues);
    const three = calculateResults({ ...baseValues, quantity: 3 });
    expect(three.totalCostWithSupplies).toBeCloseTo(one.totalCostWithSupplies * 3);
    expect(three.sellingPrice).toBeCloseTo(one.sellingPrice * 3);
    expect(three.costPerUnit).toBeCloseTo(one.costPerUnit);
    expect(three.sellingPricePerUnit).toBeCloseTo(one.sellingPricePerUnit);
    expect(three.quantity).toBe(3);
  });

  it("charges no electricity or depreciation when print time is zero", () => {
    const r = calculateResults({ ...baseValues, printTimeHours: 0, printTimeMinutes: 0 });
    expect(r.electricityCost).toBe(0);
    expect(r.depreciationCost).toBe(0);
  });

  it("MercadoLibre price leaves the target price after the fee is deducted", () => {
    const r = calculateResults(baseValues);
    expect(r.mercadoLibrePrice * (1 - MERCADOLIBRE_FEE_RATE)).toBeCloseTo(r.sellingPrice);
  });

  it("a x1 multiplier yields zero profit", () => {
    const r = calculateResults({ ...baseValues, profitMultiplier: 1 });
    expect(r.profitAmount).toBeCloseTo(0);
  });
});

describe("calculatorSchema", () => {
  it("fills defaults and coerces numeric strings", () => {
    const parsed = calculatorSchema.parse({ printWeightGrams: "120", quantity: "2" });
    expect(parsed.printWeightGrams).toBe(120);
    expect(parsed.quantity).toBe(2);
    expect(parsed.materialUsed).toBe("PLA");
  });

  it("rejects out-of-range values", () => {
    expect(calculatorSchema.safeParse({ failureRatePercent: 101 }).success).toBe(false);
    expect(calculatorSchema.safeParse({ printTimeMinutes: 60 }).success).toBe(false);
    expect(calculatorSchema.safeParse({ quantity: 0 }).success).toBe(false);
    expect(calculatorSchema.safeParse({ profitMultiplier: 11 }).success).toBe(false);
  });
});

describe("getPresetUpdates", () => {
  it("returns nothing when raw string inputs equal the saved values", () => {
    // watch() yields strings after the user types: "15000" must not count as a change from 15000
    const updates = getPresetUpdates({ filamentCostPerKg: "15000", printerPower: "120" }, printer);
    expect(updates).toEqual({});
  });

  it("returns the DB column with the coerced number for a real change", () => {
    const updates = getPresetUpdates({ filamentCostPerKg: "18000", failureRatePercent: 25 }, printer);
    expect(updates).toEqual({ filament_cost_per_kg: 18000, failure_rate_percent: 25 });
  });

  it("skips empty, whitespace, null and undefined values", () => {
    const updates = getPresetUpdates(
      { filamentCostPerKg: "", electricityCostKwh: "  ", printerPower: null, printerCost: undefined },
      printer,
    );
    expect(updates).toEqual({});
  });

  it("skips invalid values instead of syncing them", () => {
    const updates = getPresetUpdates(
      { filamentCostPerKg: "-5", failureRatePercent: "150", printerPower: "0", printerLifespan: "abc" },
      printer,
    );
    expect(updates).toEqual({});
  });
});

describe("isPresetField", () => {
  it("accepts shared printer fields and rejects piece fields", () => {
    expect(isPresetField("printerCost")).toBe(true);
    expect(isPresetField("printWeightGrams")).toBe(false);
    expect(isPresetField("quantity")).toBe(false);
  });
});
