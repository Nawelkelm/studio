import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthlySalesChart, SummaryStrip } from "./quotation-stats";
import type { StatsQuotation } from "@/lib/quotation-stats";

const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12).toISOString();
// es-AR separates thousands with a dot and uses a non-breaking space after "$"
const normalize = (html: string) => html.replace(/&nbsp;| /g, " ");
const strip = (quotations: StatsQuotation[]) => normalize(renderToStaticMarkup(h(SummaryStrip, { quotations })));

describe("SummaryStrip", () => {
  it("shows this month's totals, profit and approval rate", () => {
    const html = strip([
      { status: "aprobada", selling_price: 10000, total_cost: 4000, created_at: thisMonth },
      { status: "pendiente", selling_price: 5000, total_cost: 2000, created_at: thisMonth },
      { status: "rechazada", selling_price: 8000, total_cost: 3000, created_at: thisMonth },
    ]);
    expect(html).toContain("Cotizado este mes");
    expect(html).toContain("$ 15.000"); // approved + pending, rejected excluded
    expect(html).toContain("$ 10.000"); // approved this month
    expect(html).toContain("$ 6.000"); // profit = 10000 - 4000
    expect(html).toContain("50%"); // 1 approved / (1 approved + 1 rejected)
  });

  it("shows a dash instead of a rate while nothing has been decided", () => {
    expect(strip([{ status: "pendiente", selling_price: 500, total_cost: 200, created_at: thisMonth }])).toContain("—");
  });

  it("shows 0% when the only decided quotation was rejected", () => {
    expect(strip([{ status: "rechazada", selling_price: 1, total_cost: 1, created_at: thisMonth }])).toContain("0%");
  });
});

describe("MonthlySalesChart", () => {
  it("explains the empty state when there are no sales to chart", () => {
    const html = renderToStaticMarkup(h(MonthlySalesChart, { quotations: [{ status: "rechazada", selling_price: 1, total_cost: 1, created_at: thisMonth }] }));
    expect(html).toContain("Todavía no hay ventas");
  });

  it("renders the chart container when a pending sale exists", () => {
    const html = renderToStaticMarkup(h(MonthlySalesChart, { quotations: [{ status: "pendiente", selling_price: 500, total_cost: 200, created_at: thisMonth }] }));
    expect(html).not.toContain("Todavía no hay ventas");
    expect(html).toContain("recharts-responsive-container");
  });
});
