import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuotationStats from "./quotation-stats";
import type { StatsQuotation } from "@/lib/quotation-stats";

const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12).toISOString();
const render = (quotations: StatsQuotation[]) => renderToStaticMarkup(h(QuotationStats, { quotations }));
// es-AR separates thousands with a dot and uses a non-breaking space after "$"
const normalize = (html: string) => html.replace(/&nbsp;| /g, " ");

describe("QuotationStats", () => {
  it("shows this month's totals, profit and approval rate", () => {
    const html = normalize(
      render([
        { status: "aprobada", selling_price: 10000, total_cost: 4000, created_at: thisMonth },
        { status: "pendiente", selling_price: 5000, total_cost: 2000, created_at: thisMonth },
        { status: "rechazada", selling_price: 8000, total_cost: 3000, created_at: thisMonth },
      ]),
    );
    expect(html).toContain("Cotizado este mes");
    expect(html).toContain("$ 15.000"); // approved + pending, rejected excluded
    expect(html).toContain("$ 10.000"); // approved this month
    expect(html).toContain("$ 6.000"); // profit = 10000 - 4000
    expect(html).toContain("50%"); // 1 approved / (1 approved + 1 rejected)
    expect(html).toContain("1 aprobadas · 1 rechazadas · 1 pendientes");
  });

  it("shows 0% approval and the empty-chart message when the only quotation was rejected", () => {
    const html = normalize(render([{ status: "rechazada", selling_price: 1, total_cost: 1, created_at: thisMonth }]));
    expect(html).toContain("Todavía no hay ventas");
    expect(html).toContain("0%");
  });

  it("shows a dash instead of a rate while nothing has been decided", () => {
    const html = normalize(render([{ status: "pendiente", selling_price: 500, total_cost: 200, created_at: thisMonth }]));
    expect(html).toContain("—");
    expect(html).not.toContain("Todavía no hay ventas"); // the pending sale does feed the chart
  });
});
