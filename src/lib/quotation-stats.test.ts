import { describe, expect, it } from "vitest";
import { summarizeQuotations, type StatsQuotation } from "./quotation-stats";

// Dates are built in local time (the app groups by the browser's local month), so tests don't depend on the timezone.
const NOW = new Date(2026, 9, 19, 12); // 19 Oct 2026
const at = (year: number, monthIndex: number, day = 10): string => new Date(year, monthIndex, day, 12).toISOString();

const q = (status: StatsQuotation["status"], price: number, cost: number, created_at: string): StatsQuotation => ({
  status, selling_price: price, total_cost: cost, created_at,
});

describe("summarizeQuotations", () => {
  const data: StatsQuotation[] = [
    q("aprobada", 10000, 4000, at(2026, 9)), // this month: approved, profit 6000
    q("pendiente", 5000, 2000, at(2026, 9)), // this month: pending
    q("rechazada", 8000, 3000, at(2026, 9)), // this month: rejected (not counted as quoted)
    q("aprobada", 20000, 8000, at(2026, 8)), // September, profit 12000
    q("rechazada", 1000, 500, at(2026, 3)), // April: older than the 6-month window
  ];

  it("summarizes the current month without counting rejected quotations as quoted", () => {
    const { thisMonth } = summarizeQuotations(data, NOW);
    expect(thisMonth).toEqual({ count: 3, quoted: 15000, approved: 10000, profit: 6000 });
  });

  it("computes the approval rate over decided quotations only", () => {
    // 2 approved, 2 rejected, 1 pending => 2 / 4
    expect(summarizeQuotations(data, NOW).approvalRate).toBe(0.5);
  });

  it("returns a null approval rate when nothing has been decided", () => {
    expect(summarizeQuotations([q("pendiente", 100, 50, at(2026, 9))], NOW).approvalRate).toBeNull();
    expect(summarizeQuotations([], NOW).approvalRate).toBeNull();
  });

  it("counts every status across all quotations", () => {
    expect(summarizeQuotations(data, NOW).counts).toEqual({ pendiente: 1, aprobada: 2, rechazada: 2 });
  });

  it("builds a zero-filled, oldest-first month series ending in the current month", () => {
    const { months } = summarizeQuotations(data, NOW);
    expect(months.map((m) => m.key)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    const sep = months.find((m) => m.key === "2026-09")!;
    expect(sep).toMatchObject({ approved: 20000, pending: 0, profit: 12000, count: 1 });
    const oct = months.find((m) => m.key === "2026-10")!;
    expect(oct).toMatchObject({ approved: 10000, pending: 5000, profit: 6000, count: 3 });
    expect(months.find((m) => m.key === "2026-06")).toMatchObject({ approved: 0, pending: 0, profit: 0, count: 0 });
  });

  it("keeps quotations older than the window out of the chart but in the all-time totals", () => {
    const { months, counts } = summarizeQuotations(data, NOW);
    expect(months.some((m) => m.key === "2026-04")).toBe(false);
    expect(counts.rechazada).toBe(2);
  });

  it("crosses the year boundary correctly", () => {
    const { months } = summarizeQuotations([], new Date(2026, 1, 15, 12)); // Feb 2026
    expect(months.map((m) => m.key)).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("tolerates numeric strings and invalid dates", () => {
    const messy = [
      { status: "aprobada", selling_price: "7000", total_cost: "2500", created_at: at(2026, 9) },
      { status: "aprobada", selling_price: 999, total_cost: 1, created_at: "not-a-date" },
    ] as unknown as StatsQuotation[];
    const s = summarizeQuotations(messy, NOW);
    expect(s.thisMonth).toEqual({ count: 1, quoted: 7000, approved: 7000, profit: 4500 });
    expect(s.counts.aprobada).toBe(2);
  });
});
