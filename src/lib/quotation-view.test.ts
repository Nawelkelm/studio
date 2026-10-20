import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS, countByStatus, filterViews, filterWithoutStatus, normalizeText, printerNames, quotationsToCsv,
  sortViews, toView,
} from "./quotation-view";
import { makeItem, sampleQuotations } from "./quotation-fixtures";

const NOW = new Date(2026, 9, 20, 12); // 20 Oct 2026
const views = sampleQuotations().map((q) => toView(q, NOW));
const ids = (list: { id: string }[]) => list.map((v) => v.id);

describe("toView", () => {
  it("derives price, profit, margin and profit per print hour", () => {
    const v = toView(makeItem({ total_cost: 2500, selling_price: 10000, final_price: 8000, print_time_hours: 1, print_time_minutes: 30, quantity: 2 }), NOW);
    expect(v.price).toBe(8000);
    expect(v.profit).toBe(5500);
    expect(v.margin).toBeCloseTo(68.75);
    expect(v.printHours).toBeCloseTo(3); // 1,5 h x 2 units
    expect(v.profitPerHour).toBeCloseTo(1833.33, 1);
    expect(v.discount).toBeCloseTo(20); // 8000 against 10000
  });

  it("falls back to the calculated price for quotations made before final_price existed", () => {
    expect(toView(makeItem({ final_price: null, selling_price: 9000 }), NOW).price).toBe(9000);
  });

  it("has no profit per hour without print time", () => {
    const v = toView(makeItem({ print_time_hours: 0, print_time_minutes: 0 }), NOW);
    expect(v.profitPerHour).toBeNull();
  });

  it("copes with numeric strings from the database", () => {
    const v = toView(makeItem({ total_cost: "2500" as unknown as number, selling_price: "10000" as unknown as number, final_price: "10000" as unknown as number }), NOW);
    expect(v.profit).toBe(7500);
  });

  it("flags only pending quotations past their validity date", () => {
    expect(toView(makeItem({ status: "pendiente", valid_until: "2026-10-19" }), NOW).isExpired).toBe(true);
    expect(toView(makeItem({ status: "pendiente", valid_until: "2026-10-20" }), NOW).isExpired).toBe(false); // valid through today
    expect(toView(makeItem({ status: "aprobada", valid_until: "2026-10-01" }), NOW).isExpired).toBe(false);
    expect(toView(makeItem({ status: "pendiente", valid_until: null }), NOW).isExpired).toBe(false);
  });
});

describe("filters", () => {
  it("normalizes accents and case in searches", () => {
    expect(normalizeText("  María FERNÁNDEZ ")).toBe("maria fernandez");
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, search: "maria" }, NOW))).toEqual(["s1", "s6"]);
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, search: "LLAVERO" }, NOW))).toEqual(["s1", "s6"]);
  });

  it("searches client, piece, contact, material and printer", () => {
    const withContact = [...views, toView(makeItem({ id: "x", client_contact: "11-5555-0000" }), NOW)];
    expect(ids(filterViews(withContact, { ...DEFAULT_FILTERS, search: "5555" }, NOW))).toEqual(["x"]);
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, search: "tpu" }, NOW))).toEqual(["s7"]);
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, search: "snapmaker" }, NOW))).toEqual(["s4", "s5"]);
  });

  it("filters by status, channel and printer, and combines them", () => {
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, status: "rechazada" }, NOW))).toEqual(["s3", "s5", "s7"]);
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, channel: "instagram" }, NOW))).toEqual(["s1", "s5", "s6"]);
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, printer: "Bambu Lab P1S" }, NOW))).toEqual(["s2", "s3", "s8"]);
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, channel: "instagram", status: "aprobada" }, NOW))).toEqual(["s1", "s6"]);
  });

  it("filters by period in local time", () => {
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, period: "month" }, NOW))).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    // s6 is 30 days and a few hours old: just outside "últimos 30 días"
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, period: "30d" }, NOW))).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    expect(ids(filterViews(views, { ...DEFAULT_FILTERS, period: "90d" }, NOW))).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]);
    const edge = [
      toView(makeItem({ id: "d29", created_at: new Date(NOW.getTime() - 29 * 24 * 3600 * 1000).toISOString() }), NOW),
      toView(makeItem({ id: "d31", created_at: new Date(NOW.getTime() - 31 * 24 * 3600 * 1000).toISOString() }), NOW),
    ];
    expect(ids(filterViews(edge, { ...DEFAULT_FILTERS, period: "30d" }, NOW))).toEqual(["d29"]);
  });

  it("counts quotations per status over the other filters, so chips stay meaningful", () => {
    const base = filterWithoutStatus(views, { ...DEFAULT_FILTERS, channel: "instagram", status: "aprobada" }, NOW);
    expect(countByStatus(base)).toEqual({ todas: 3, pendiente: 0, aprobada: 2, rechazada: 1 });
  });

  it("lists the printers present, alphabetically", () => {
    expect(printerNames(views)).toEqual(["Bambu Lab A1", "Bambu Lab P1S", "Snapmaker U1"]);
  });
});

describe("sortViews", () => {
  it("sorts newest first by default and does not mutate the input", () => {
    const copy = [...views];
    expect(ids(sortViews(views, "recent"))[0]).toBe("s4");
    expect(views).toEqual(copy);
  });

  it("sorts by price, margin and profit per hour, best first", () => {
    expect(ids(sortViews(views, "price"))[0]).toBe("s4"); // 140.000
    const perHour = sortViews(views, "perHour");
    expect(perHour[0].profitPerHour!).toBeGreaterThanOrEqual(perHour[1].profitPerHour!);
  });

  it("puts quotations without print time last when sorting by profit per hour", () => {
    const list = [toView(makeItem({ id: "none", print_time_hours: 0, print_time_minutes: 0 }), NOW), toView(makeItem({ id: "some" }), NOW)];
    expect(ids(sortViews(list, "perHour"))).toEqual(["some", "none"]);
  });
});

describe("quotationsToCsv", () => {
  it("starts with a BOM and a header, and uses ';' with decimal commas for Excel in Argentina", () => {
    const csv = quotationsToCsv([toView(makeItem({ id: "c", client_name: 'Juan "el Pibe"', piece_name: "Pieza; rara", total_cost: 2500, selling_price: 10000, final_price: 9000.5, status: "aprobada", lost_reason: null, internal_notes: "línea1\nlínea2" }), NOW)]);
    const [header, row] = csv.replace("﻿", "").split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(header.split(";")).toHaveLength(21);
    expect(row).toContain('"Juan ""el Pibe"""');
    expect(row).toContain('"Pieza; rara"');
    expect(row).toContain("9000,50"); // final price
    expect(row).toContain('"línea1 línea2"');
    expect(row.split(";").length).toBeGreaterThanOrEqual(21);
  });

  it("writes one row per quotation", () => {
    expect(quotationsToCsv(views).trim().split("\r\n")).toHaveLength(views.length + 1);
  });
});
