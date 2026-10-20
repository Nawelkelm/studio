import { describe, expect, it } from "vitest";
import { MIN_DECIDED_FOR_INSIGHTS, buildInsights } from "./quotation-insights";
import { toView } from "./quotation-view";
import { makeItem, sampleQuotations } from "./quotation-fixtures";

const NOW = new Date(2026, 9, 20, 12);
const views = sampleQuotations().map((q) => toView(q, NOW));

describe("buildInsights", () => {
  const insights = buildInsights(views);

  it("counts decided quotations and flags thin data", () => {
    expect(insights.decidedCount).toBe(7); // 4 approved + 3 rejected
    expect(insights.hasEnoughData).toBe(true);
    expect(buildInsights(views.slice(0, 3)).hasEnoughData).toBe(false);
    expect(MIN_DECIDED_FOR_INSIGHTS).toBe(5);
  });

  it("ranks profit per print hour by material, over approved jobs only", () => {
    // PLA approved: s1 (profit 38.000 / 30 h), s6 (15.000 / 10 h) => 53.000 / 40 h = 1.325
    // PETG approved: s2 (29.400 / 12 h), s8 (25.200 / 7,5 h) => 54.600 / 19,5 h = 2.800
    const [first, second] = insights.perHourByMaterial;
    expect(first).toMatchObject({ label: "PETG", count: 2 });
    expect(first.value).toBeCloseTo(2800);
    expect(second).toMatchObject({ label: "PLA", count: 2 });
    expect(second.value).toBeCloseTo(1325);
    expect(insights.perHourByMaterial.map((r) => r.label)).not.toContain("TPU"); // only rejected
  });

  it("ranks profit per print hour by printer", () => {
    expect(insights.perHourByPrinter.map((r) => r.label)).toEqual(["Bambu Lab P1S", "Bambu Lab A1"]);
  });

  it("groups materials and printers ignoring case and accents", () => {
    const list = [
      toView(makeItem({ id: "a", status: "aprobada", material_used: "PLA" }), NOW),
      toView(makeItem({ id: "b", status: "aprobada", material_used: " pla " }), NOW),
    ];
    expect(buildInsights(list).perHourByMaterial).toHaveLength(1);
  });

  it("skips approved jobs without print time", () => {
    const list = [toView(makeItem({ status: "aprobada", print_time_hours: 0, print_time_minutes: 0 }), NOW)];
    expect(buildInsights(list).perHourByMaterial).toEqual([]);
  });

  it("summarizes channels with win rate and revenue, best revenue first", () => {
    const ig = insights.channels.find((c) => c.channel === "instagram")!;
    expect(ig).toMatchObject({ total: 3, approved: 2, rejected: 1 });
    expect(ig.winRate).toBeCloseTo(2 / 3);
    expect(ig.revenue).toBe(72000); // 52.000 + 20.000
    // "directo" sold 39.200 + 33.600 = 72.800, slightly more than Instagram
    expect(insights.channels.slice(0, 2).map((c) => [c.channel, c.revenue])).toEqual([["directo", 72800], ["instagram", 72000]]);
    const wa = insights.channels.find((c) => c.channel === "whatsapp")!;
    expect(wa.winRate).toBeNull(); // nothing decided yet
  });

  it("lists top clients by approved revenue and ignores clients without approved sales", () => {
    expect(insights.topClients.map((c) => c.name)).toEqual(["María Fernández", "Estudio Nómade", "Taller Ruiz"]);
    expect(insights.topClients[0]).toMatchObject({ total: 2, approved: 2, revenue: 72000 });
  });

  it("groups clients written with different case or accents", () => {
    const list = [
      toView(makeItem({ client_name: "maria fernandez", status: "aprobada" }), NOW),
      toView(makeItem({ client_name: "María Fernández", status: "aprobada" }), NOW),
    ];
    expect(buildInsights(list).topClients).toHaveLength(1);
  });

  it("counts lost reasons, with a bucket for old rejections without a reason", () => {
    expect(insights.lostReasons).toHaveLength(3);
    const withLegacy = buildInsights([...views, toView(makeItem({ status: "rechazada", lost_reason: null }), NOW)]);
    expect(withLegacy.lostReasons.find((r) => r.reason === "sin_motivo")?.count).toBe(1);
  });

  it("measures how much approved quotations were discounted", () => {
    // s1 52.000 vs 56.000 => 7,14 %; s2, s6, s8 no discount => average 1,79 %; 1 of 4 discounted
    expect(insights.averageDiscount).toBeCloseTo(1.79, 1);
    expect(insights.discountedShare).toBe(0.25);
  });

  it("returns empty, null-safe results for no data", () => {
    const empty = buildInsights([]);
    expect(empty).toMatchObject({ decidedCount: 0, hasEnoughData: false, channels: [], topClients: [], lostReasons: [], averageDiscount: null, discountedShare: null });
  });
});
