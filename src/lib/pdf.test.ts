import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { buildQuotationPdf, quotationFileName } from "./quotation-pdf";

// Smoke test of the exact jsPDF + jspdf-autotable calls used by the quotation PDFs
// (calculator-form.tsx and quotation-registry.tsx), to catch breaking library upgrades.
describe("buildQuotationPdf", () => {
  const business = { businessName: "Doji Print - Impresiones 3D", cuit: "", address: "", phone: "11-5555-0000" };
  const base = { clientName: "Cliente Ñandú", quantity: 1, finalPrice: 7050, pricePerUnit: 7050, business };
  const logo = () => `data:image/png;base64,${readFileSync("public/logo.png").toString("base64")}`;
  const bytesOf = (doc: { output: (t: "arraybuffer") => ArrayBuffer }) => new Uint8Array(doc.output("arraybuffer"));
  const header = (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 5));

  it("builds a valid one-page quotation with the minimum data", async () => {
    const doc = await buildQuotationPdf(base);
    expect(header(bytesOf(doc))).toBe("%PDF-");
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("builds a complete quotation: logo, piece, contact, printer, batch rows and validity", async () => {
    const doc = await buildQuotationPdf(
      { ...base, quantity: 3, finalPrice: 21150, pieceName: "Llavero dragón", materialUsed: "PLA", clientContact: "11-4444-0000",
        printerName: "Bambu Lab A1", validUntil: "2026-11-04", date: new Date(2026, 9, 20) },
      logo(),
    );
    expect(header(bytesOf(doc))).toBe("%PDF-");
    expect(bytesOf(doc).length).toBeGreaterThan(5000); // includes the embedded logo
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.lastAutoTable.finalY).toBeGreaterThan(60);
  });

  it("survives an unreadable logo", async () => {
    const doc = await buildQuotationPdf(base, "data:image/png;base64,not-an-image");
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

describe("quotationFileName", () => {
  it("builds a safe file name from the client and the piece", () => {
    expect(quotationFileName("Juan Pérez")).toBe("Cotizacion-Juan_Pérez.pdf");
    expect(quotationFileName("  María  ", "Llavero / dragón!")).toBe("Cotizacion-María-Llavero_dragón.pdf");
    expect(quotationFileName("   ")).toBe("Cotizacion-Cliente.pdf");
  });
});

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
