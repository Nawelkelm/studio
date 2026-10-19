import { z } from "zod";

/** Cost data from the calculator that grounds the AI suggestion (all amounts in ARS, per unit). */
export const costContextSchema = z.object({
  costPerUnit: z.number().finite().min(0).max(1e9),
  sellingPricePerUnit: z.number().finite().min(0).max(1e9),
  profitMultiplier: z.number().finite().min(1).max(10),
});

export type CostContext = z.infer<typeof costContextSchema>;

export const pricingRequestSchema = z.object({
  productDescription: z.string().trim().min(1).max(500),
  materialUsed: z.string().trim().min(1).max(50),
  printingTime: z.string().trim().min(1).max(50),
  costContext: costContextSchema.optional(),
});

export type PricingRequest = z.infer<typeof pricingRequestSchema>;

export type ParsedPricingRequest =
  | { ok: true; data: PricingRequest }
  | { ok: false; error: string };

export function parsePricingRequest(body: unknown): ParsedPricingRequest {
  const parsed = pricingRequestSchema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };
  const tooLong = parsed.error.issues.some((i) => i.code === "too_big" && i.path[0] !== "costContext");
  return {
    ok: false,
    error: tooLong ? "Alguno de los campos supera el largo permitido" : "Faltan campos requeridos o son inválidos",
  };
}

const formatArs = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

export function buildPricingPrompt(req: PricingRequest): string {
  const costLines = req.costContext
    ? `
Datos reales de costo calculados por el usuario (por unidad):
- Costo de producción: ${formatArs(req.costContext.costPerUnit)} (incluye material, electricidad, amortización de la máquina, margen de fallos y adicionales).
- Precio calculado con su multiplicador x${req.costContext.profitMultiplier}: ${formatArs(req.costContext.sellingPricePerUnit)}.
Usá estos datos como base: el precio sugerido nunca debe ser menor al costo de producción. Indicá en el razonamiento si el precio calculado te parece bajo, adecuado o alto para el mercado argentino.
`
    : "";

  return `Eres un asistente de precios de IA para productos impresos en 3D.
Basado en la descripción del producto, el material utilizado y el tiempo de impresión, sugiere un precio de venta razonable en Pesos Argentinos (ARS).
El precio debe incluir el símbolo de la moneda (ej: $1500 ARS).
Proporciona una breve explicación de tu razonamiento detrás del precio sugerido.

Descripción del Producto: ${req.productDescription}
Material Usado: ${req.materialUsed}
Tiempo de Impresión: ${req.printingTime}
${costLines}
Responde SOLO con un JSON válido con esta estructura exacta (sin markdown, sin backticks):
{"suggestedPrice": "$XXXX ARS", "reasoning": "tu explicación aquí"}`;
}
