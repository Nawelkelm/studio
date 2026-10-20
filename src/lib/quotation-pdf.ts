import type { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/format";
import { DEFAULT_VALIDITY_DAYS, formatDateOnly } from "@/lib/quotation-meta";

export type BusinessInfo = { businessName: string; cuit: string; address: string; phone: string };

export type QuotationPdfData = {
  clientName: string;
  clientContact?: string;
  pieceName?: string;
  materialUsed?: string;
  printerName?: string;
  quantity: number;
  /** Price charged for the whole batch */
  finalPrice: number;
  pricePerUnit: number;
  /** YYYY-MM-DD; when missing the footer says "Válido por 7 días" */
  validUntil?: string;
  business: BusinessInfo;
  date?: Date;
};

const PURPLE: [number, number, number] = [30, 16, 84];

/** Client-facing quotation: one commercial service line and a total. Internal costs never appear here. */
export async function buildQuotationPdf(data: QuotationPdfData, logoDataUrl?: string | null): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new JsPDF();

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", 14, 8, 28, 28); } catch { /* the quotation is still valid without the logo */ }
  }

  doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("COTIZACIÓN", 48, 22);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 80, 160);
  doc.text("Doji Print - Impresiones 3D", 48, 30); doc.setTextColor(0, 0, 0);

  const { business } = data;
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text(business.businessName, 140, 18);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  let infoY = 24;
  if (business.cuit) { doc.text(`CUIT: ${business.cuit}`, 140, infoY); infoY += 5; }
  if (business.address) { doc.text(business.address, 140, infoY); infoY += 5; }
  if (business.phone) { doc.text(`Tel: ${business.phone}`, 140, infoY); }
  doc.line(14, 42, 196, 42);

  doc.setFontSize(12);
  doc.text(`Fecha: ${(data.date ?? new Date()).toLocaleDateString("es-AR")}`, 140, 52);
  doc.text(`Cliente: ${data.clientName}`, 14, 52);
  doc.setFontSize(9);
  let metaY = 58;
  if (data.clientContact) { doc.text(`Contacto: ${data.clientContact}`, 14, metaY); metaY += 5; }
  if (data.printerName) { doc.text(`Impresora: ${data.printerName}`, 14, metaY); metaY += 5; }
  const startY = metaY > 58 ? metaY + 2 : 60;

  const service = data.pieceName ? `Impresión 3D: ${data.pieceName}` : "Servicio de impresión 3D personalizado";
  const body: string[][] = [[service, data.materialUsed ?? "", formatCurrency(data.finalPrice)]];
  if (data.quantity > 1) {
    body.push(["Cantidad", `${data.quantity} unidades`, ""]);
    body.push(["Precio por unidad", "", formatCurrency(data.pricePerUnit)]);
  }
  autoTable(doc, { startY, head: [["Servicio", "Detalle", "Total"]], body, theme: "striped", headStyles: { fillColor: PURPLE } });

  const finalY = doc.lastAutoTable.finalY || 100;
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("TOTAL SERVICIO:", 140, finalY + 20, { align: "right" });
  doc.text(formatCurrency(data.finalPrice), 196, finalY + 20, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Cotización comercial: no incluye desglose de costos internos.", 14, finalY + 28);

  const pageH = doc.internal.pageSize.height;
  const validity = data.validUntil ? `Válido hasta el ${formatDateOnly(data.validUntil)}.` : `Válido por ${DEFAULT_VALIDITY_DAYS} días.`;
  doc.line(14, pageH - 20, 196, pageH - 20); doc.setFontSize(8);
  doc.text(`Documento no válido como comprobante fiscal. ${validity}`, 105, pageH - 15, { align: "center" });
  return doc;
}

export function quotationFileName(clientName: string, pieceName?: string): string {
  const clean = (s: string) => s.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
  const parts = [clean(clientName) || "Cliente", pieceName ? clean(pieceName) : ""].filter(Boolean);
  return `Cotizacion-${parts.join("-")}.pdf`;
}

/** Browser only: reads /logo.png as a data URL (null if it can't be loaded). */
export async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch("/logo.png")).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
