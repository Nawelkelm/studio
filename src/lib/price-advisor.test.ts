import { describe, expect, it, vi } from "vitest";
import { advisorBlocker, buildAdvisorRequest, ladderScale, requestSuggestion, spreadLabels, tierMetrics } from "./price-advisor";
import { calculateResults, type CalculatorFormValues } from "./calculator";
import { emptyDraft } from "./quote-draft";
import { pricingRequestSchema } from "./pricing-prompt";

const values: CalculatorFormValues = {
  filamentCostPerKg: 20000, materialUsed: "PLA", electricityCostKwh: 100, printerPower: 200, printerLifespan: 5000,
  printerCost: 100000, failureRatePercent: 10, printTimeHours: 2, printTimeMinutes: 30, printWeightGrams: 100,
  extraCosts: 40, profitMultiplier: 3, quantity: 4,
};
const results = calculateResults(values);
const draft = { ...emptyDraft(new Date(2026, 9, 20)), pieceName: "Llavero dragón", channel: "mercadolibre" as const };

describe("buildAdvisorRequest", () => {
  it("maps the quoting screen to a valid AI request, per unit", () => {
    const req = buildAdvisorRequest({ values, results, draft, strategy: "competitive" })!;
    expect(req).toMatchObject({
      pieceName: "Llavero dragón", materialUsed: "PLA", weightGrams: 100, printTimeHours: 2.5, quantity: 4, channel: "mercadolibre",
      strategy: "competitive", multiplier: 3,
    });
    expect(req.costPerUnit).toBeCloseTo(2350);
    expect(req.currentPricePerUnit).toBeCloseTo(7050);
    expect(pricingRequestSchema.safeParse(req).success).toBe(true);
  });

  it("includes the description only when there is one", () => {
    expect(buildAdvisorRequest({ values, results, draft, strategy: "balanced" })!.pieceDescription).toBeUndefined();
    expect(buildAdvisorRequest({ values, results, draft: { ...draft, pieceDescription: " PETG negro " }, strategy: "balanced" })!.pieceDescription).toBe("PETG negro");
  });

  it("returns null while there is no valid calculation", () => {
    expect(buildAdvisorRequest({ values: null, results, draft, strategy: "balanced" })).toBeNull();
    expect(buildAdvisorRequest({ values, results: null, draft, strategy: "balanced" })).toBeNull();
  });
});

describe("advisorBlocker", () => {
  it("explains what is missing", () => {
    expect(advisorBlocker(draft, false)).toMatch(/peso y el tiempo/);
    expect(advisorBlocker({ ...draft, pieceName: " " }, true)).toMatch(/qué pieza es/);
    expect(advisorBlocker(draft, true)).toBeNull();
  });
});

describe("requestSuggestion", () => {
  const request = buildAdvisorRequest({ values, results, draft, strategy: "balanced" })!;
  const ok = { minimo: 3000, recomendado: 4200, premium: 5600, razones: ["a"], alerta: null, similarCount: 2 };
  const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("posts the request with the session token and returns the answer", async () => {
    const fetchImpl = reply(200, ok);
    expect(await requestSuggestion(request, async () => "tok", fetchImpl)).toEqual(ok);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/suggest-pricing");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
    expect(JSON.parse(String(init.body))).toMatchObject({ pieceName: "Llavero dragón" });
  });

  it("surfaces the server's message on failure and a generic one when there is none", async () => {
    await expect(requestSuggestion(request, async () => "t", reply(429, { error: "Demasiadas consultas." }))).rejects.toThrow("Demasiadas consultas.");
    await expect(requestSuggestion(request, async () => "t", reply(500, {}))).rejects.toThrow(/Error del servidor \(500\)/);
  });

  it("rejects an answer that is missing the prices", async () => {
    await expect(requestSuggestion(request, async () => "t", reply(200, { minimo: 1 }))).rejects.toThrow(/incompleta/);
  });
});

describe("tierMetrics", () => {
  it("computes the margin over the price and the distance from the current price", () => {
    const m = tierMetrics(4000, 2000, 5000);
    expect(m.margin).toBeCloseTo(50);
    expect(m.vsCurrent).toBeCloseTo(-20);
    expect(tierMetrics(6000, 2000, 5000).vsCurrent).toBeCloseTo(20);
    expect(tierMetrics(100, 50, 0).vsCurrent).toBe(0);
  });
});

describe("ladderScale", () => {
  const input = { cost: 2350, minimo: 3000, recomendado: 4200, premium: 5600, current: 9400 };

  it("fits every price inside 0-100 with air at both ends", () => {
    const { position } = ladderScale(input);
    for (const v of Object.values(input)) expect(position(v)).toBeGreaterThan(0);
    for (const v of Object.values(input)) expect(position(v)).toBeLessThan(100);
    expect(position(input.cost)).toBeLessThan(position(input.minimo));
    expect(position(input.premium)).toBeLessThan(position(input.current));
  });

  it("keeps working when all prices are equal", () => {
    const { position } = ladderScale({ cost: 100, minimo: 100, recomendado: 100, premium: 100, current: 100 });
    expect(position(100)).toBeGreaterThan(0);
    expect(position(100)).toBeLessThan(100);
  });

  it("clamps values outside the scale", () => {
    const { position } = ladderScale(input);
    expect(position(-1000)).toBe(0);
    expect(position(1e9)).toBe(100);
  });
});

describe("spreadLabels", () => {
  it("leaves well separated labels where they are", () => {
    expect(spreadLabels([{ position: 10 }, { position: 50 }, { position: 90 }]).map((l) => l.left)).toEqual([10, 50, 90]);
  });

  it("pushes crowded labels apart, keeping order", () => {
    const out = spreadLabels([{ position: 40, id: "b" }, { position: 38, id: "a" }, { position: 42, id: "c" }], 20);
    expect(out.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(out.map((l) => l.left)).toEqual([38, 58, 78]);
  });

  it("never goes past the right edge", () => {
    expect(spreadLabels([{ position: 95 }, { position: 99 }]).every((l) => l.left <= 100)).toBe(true);
  });
});
