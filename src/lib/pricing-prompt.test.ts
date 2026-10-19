import { describe, expect, it } from "vitest";
import { buildPricingPrompt, parsePricingRequest } from "./pricing-prompt";

const base = { productDescription: "Llavero de dragón articulado", materialUsed: "PLA", printingTime: "2 horas" };
const costContext = { costPerUnit: 2350, sellingPricePerUnit: 7050, profitMultiplier: 3 };

describe("parsePricingRequest", () => {
  it("accepts a request without cost data", () => {
    const r = parsePricingRequest(base);
    expect(r.ok).toBe(true);
  });

  it("accepts a request with cost data and trims text fields", () => {
    const r = parsePricingRequest({ ...base, materialUsed: "  PETG ", costContext });
    expect(r).toEqual({ ok: true, data: { ...base, materialUsed: "PETG", costContext } });
  });

  it("rejects missing, blank or non-string fields", () => {
    for (const body of [null, undefined, {}, { ...base, productDescription: "   " }, { ...base, printingTime: 2 }]) {
      const r = parsePricingRequest(body);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Faltan campos/);
    }
  });

  it("rejects fields over the length limit", () => {
    const r = parsePricingRequest({ ...base, productDescription: "x".repeat(501) });
    expect(r).toEqual({ ok: false, error: "Alguno de los campos supera el largo permitido" });
  });

  it("rejects cost data that is out of range or not numeric", () => {
    for (const bad of [
      { ...costContext, profitMultiplier: 0.5 },
      { ...costContext, profitMultiplier: 11 },
      { ...costContext, costPerUnit: -1 },
      { ...costContext, costPerUnit: "2350" },
      { ...costContext, sellingPricePerUnit: Infinity },
    ]) {
      expect(parsePricingRequest({ ...base, costContext: bad }).ok).toBe(false);
    }
  });
});

describe("buildPricingPrompt", () => {
  it("includes the product data and the JSON answer format", () => {
    const prompt = buildPricingPrompt(base);
    expect(prompt).toContain("Llavero de dragón articulado");
    expect(prompt).toContain("Material Usado: PLA");
    expect(prompt).toContain('{"suggestedPrice"');
  });

  it("omits cost lines when there is no cost data", () => {
    expect(buildPricingPrompt(base)).not.toContain("Costo de producción");
  });

  it("anchors the suggestion on the real cost when cost data is provided", () => {
    const prompt = buildPricingPrompt({ ...base, costContext });
    expect(prompt).toMatch(/Costo de producción: \$\s?2\.350/);
    expect(prompt).toMatch(/multiplicador x3: \$\s?7\.050/);
    expect(prompt).toContain("nunca debe ser menor al costo de producción");
  });
});
