import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PriceAdvisor } from "./ai-pricing-assistant";
import { PriceLadder } from "./quote/price-ladder";
import { calculateResults, type CalculatorFormValues } from "@/lib/calculator";
import { emptyDraft } from "@/lib/quote-draft";

const values: CalculatorFormValues = {
  filamentCostPerKg: 20000, materialUsed: "PLA", electricityCostKwh: 100, printerPower: 200, printerLifespan: 5000,
  printerCost: 100000, failureRatePercent: 10, printTimeHours: 2, printTimeMinutes: 30, printWeightGrams: 100,
  extraCosts: 40, profitMultiplier: 3, quantity: 1,
};
const results = calculateResults(values);
const normalize = (html: string) => html.replace(/&nbsp;| /g, " ");

/** The opening tag of the "Pedir sugerencia" button */
const askButton = (html: string) => /<button(?:(?!<\/button>)[\s\S])*?Pedir sugerencia<\/button>/.exec(html)?.[0].split(">")[0] ?? "";

const render = (over: Partial<Parameters<typeof PriceAdvisor>[0]> = {}) =>
  normalize(renderToStaticMarkup(h(PriceAdvisor, {
    results, values, draft: { ...emptyDraft(), pieceName: "Llavero dragón" }, onDraftChange: () => {}, onApplyPrice: () => {}, ...over,
  })));

describe("PriceAdvisor (initial state)", () => {
  it("explains what it does and offers the three priorities", () => {
    const html = render();
    expect(html).toContain("Asesor de precio con IA");
    expect(html).toContain("cotizaciones parecidas");
    for (const label of ["Equilibrado", "Más competitivo", "Premium"]) expect(html).toContain(label);
  });

  it("shows the piece name from the quotation and lets the user ask", () => {
    const html = render();
    expect(html).toContain('value="Llavero dragón"');
    expect(html).toContain("Pedir sugerencia");
    expect(askButton(html)).not.toContain('disabled=""');
  });

  it("explains why it can't be asked yet: no calculation, or no piece name", () => {
    expect(render({ results: null, values: null })).toContain("Completá el peso y el tiempo");
    const noName = render({ draft: { ...emptyDraft(), pieceName: "" } });
    expect(noName).toContain("Escribí qué pieza es");
    expect(askButton(noName)).toContain('disabled=""');
    expect(askButton(noName)).toContain('aria-describedby="advisor-blocker"');
  });
});

describe("PriceLadder", () => {
  const ladder = () => normalize(renderToStaticMarkup(h(PriceLadder, { cost: 2350, minimo: 3000, recomendado: 4200, premium: 5600, current: 9400 })));

  it("describes the scale for screen readers with every price", () => {
    const html = ladder();
    expect(html).toContain('role="img"');
    expect(html).toMatch(/costo \$\s?2\.350, mínimo \$\s?3\.000, recomendado \$\s?4\.200, premium \$\s?5\.600, tu precio actual \$\s?9\.400/);
  });

  it("labels the markers", () => {
    const html = ladder();
    for (const label of ["Costo", "Mínimo", "Premium", "Tu precio", "Recomendado"]) expect(html).toContain(label);
  });
});
