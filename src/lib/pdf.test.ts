import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

// Smoke test of the exact jsPDF + jspdf-autotable calls used by the quotation PDFs
// (calculator-form.tsx and quotation-registry.tsx), to catch breaking library upgrades.
describe("quotation PDF generation", () => {
  it("builds a quotation with logo, table and totals", () => {
    const doc = new jsPDF();
    const logo = `data:image/png;base64,${readFileSync("public/logo.png").toString("base64")}`;
    doc.addImage(logo, "PNG", 14, 8, 28, 28);

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("COTIZACIÓN", 48, 22);
    doc.line(14, 42, 196, 42);

    autoTable(doc, {
      startY: 60,
      head: [["Servicio", "Detalle", "Total"]],
      body: [
        ["Servicio de impresión 3D personalizado", "", "$ 7.050,00"],
        ["Cantidad", "3 unidades", ""],
      ],
      theme: "striped",
      headStyles: { fillColor: [30, 16, 84] },
    });

    expect(doc.lastAutoTable.finalY).toBeGreaterThan(60);
    doc.text("TOTAL SERVICIO:", 140, doc.lastAutoTable.finalY + 20, { align: "right" });

    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("builds the landscape registry with column styles", () => {
    const doc = new jsPDF({ orientation: "landscape" });
    autoTable(doc, {
      startY: 34,
      head: [["Fecha", "Cliente", "Cant.", "Costo", "Precio"]],
      body: [["19/10/2026", "Cliente Ñandú", "2", "$ 1.000,00", "$ 5.000,00"]],
      theme: "striped",
      headStyles: { fillColor: [30, 16, 84], fontSize: 8 },
      styles: { fontSize: 7.5 },
      columnStyles: { 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } },
    });
    expect(doc.lastAutoTable.finalY).toBeGreaterThan(34);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
  });

  it("paginates a long registry onto several pages", () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const body = Array.from({ length: 80 }, (_, i) => [`${i + 1}`, `Cliente ${i + 1}`, "$ 1,00"]);
    autoTable(doc, { startY: 34, head: [["#", "Cliente", "Precio"]], body });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
