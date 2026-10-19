import { z } from "zod";
import type { Printer } from "@/lib/supabase";

export const calculatorSchema = z.object({
  filamentCostPerKg: z.coerce.number().min(0).default(15000),
  materialUsed: z.string().min(1, "Requerido").default("PLA"),
  electricityCostKwh: z.coerce.number().min(0).default(140),
  printerPower: z.coerce.number().min(1).default(120),
  printerLifespan: z.coerce.number().min(1).default(4320),
  printerCost: z.coerce.number().min(0).default(150000),
  failureRatePercent: z.coerce.number().min(0).max(100).default(30),
  printTimeHours: z.coerce.number().min(0).default(0),
  printTimeMinutes: z.coerce.number().min(0).max(59).default(0),
  printWeightGrams: z.coerce.number().min(0).default(95),
  extraCosts: z.coerce.number().min(0).default(0),
  profitMultiplier: z.coerce.number().min(1).max(10).default(5),
  quantity: z.coerce.number().min(1).default(1),
});

export type CalculatorFormValues = z.infer<typeof calculatorSchema>;

export type CalculationResults = {
  materialCost: number; electricityCost: number; depreciationCost: number;
  errorMarginCost: number; suppliesCost: number; totalCostWithSupplies: number;
  sellingPrice: number; mercadoLibrePrice: number; profitAmount: number;
  costPerUnit: number; sellingPricePerUnit: number; quantity: number;
};

// MercadoLibre descuenta la comisión del precio de venta: para recibir el precio objetivo hay que dividir por (1 - comisión)
export const MERCADOLIBRE_FEE_RATE = 0.16;

/** Costs and prices for `values.quantity` units. Material, electricity and depreciation are per unit. */
export function calculateResults(values: CalculatorFormValues): CalculationResults {
  const {
    filamentCostPerKg, electricityCostKwh, printerPower, printerLifespan, printerCost, failureRatePercent,
    printTimeHours, printTimeMinutes, printWeightGrams, extraCosts, profitMultiplier, quantity,
  } = values;

  const totalPrintTimeHours = printTimeHours + (printTimeMinutes / 60);
  const materialCostUnit = (filamentCostPerKg / 1000) * printWeightGrams;
  const electricityCostUnit = (printerPower / 1000) * totalPrintTimeHours * electricityCostKwh;
  const depreciationCostUnit = printerLifespan > 0 ? (printerCost / printerLifespan) * totalPrintTimeHours : 0;
  const baseCostUnit = materialCostUnit + electricityCostUnit + depreciationCostUnit;
  const errorMarginCostUnit = baseCostUnit * (failureRatePercent / 100);
  const totalCostUnit = baseCostUnit + errorMarginCostUnit + extraCosts;
  const sellingPriceUnit = totalCostUnit * profitMultiplier;
  const totalCostWithSupplies = totalCostUnit * quantity;
  const sellingPrice = sellingPriceUnit * quantity;

  return {
    materialCost: materialCostUnit * quantity,
    electricityCost: electricityCostUnit * quantity,
    depreciationCost: depreciationCostUnit * quantity,
    errorMarginCost: errorMarginCostUnit * quantity,
    suppliesCost: extraCosts * quantity,
    totalCostWithSupplies,
    sellingPrice,
    mercadoLibrePrice: sellingPrice / (1 - MERCADOLIBRE_FEE_RATE),
    profitAmount: sellingPrice - totalCostWithSupplies,
    costPerUnit: totalCostUnit,
    sellingPricePerUnit: sellingPriceUnit,
    quantity,
  };
}

// Fields synced to the Supabase printers table (shared across all users) and their DB columns
export const PRESET_COLUMNS = {
  filamentCostPerKg: 'filament_cost_per_kg',
  electricityCostKwh: 'electricity_cost_kwh',
  printerPower: 'printer_power',
  printerLifespan: 'printer_lifespan',
  printerCost: 'printer_cost',
  failureRatePercent: 'failure_rate_percent',
} as const satisfies Record<string, keyof Printer>;

export type PresetField = keyof typeof PRESET_COLUMNS;

export function isPresetField(name: string): name is PresetField {
  return name in PRESET_COLUMNS;
}

/**
 * DB column -> new value for every preset field that is valid and differs from the saved printer.
 * `values` come from react-hook-form's watch(), i.e. raw input strings: empty or invalid ones are skipped.
 */
export function getPresetUpdates(
  values: Partial<Record<PresetField, unknown>>,
  printer: Printer,
): Record<string, number> {
  const updates: Record<string, number> = {};
  for (const field of Object.keys(PRESET_COLUMNS) as PresetField[]) {
    const raw = values[field];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const parsed = calculatorSchema.shape[field].safeParse(raw);
    const column = PRESET_COLUMNS[field];
    if (parsed.success && parsed.data !== printer[column]) updates[column] = parsed.data;
  }
  return updates;
}
