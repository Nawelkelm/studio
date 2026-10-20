import type { jsPDF } from "jspdf";
import { channelLabel } from "@/lib/quotation-meta";
import { formatCurrency } from "@/lib/format";
import { formatPercent } from "@/lib/format";
import type { QuotationView } from "@/lib/quotation-view";

const STATUS_TEXT: Record<QuotationView["status"], string> = { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" };

/** Internal listing of the (already filtered) quotations, landscape. Contains costs: not for customers. */
export async function buildRegistryPdf(views: QuotationView[], logoDataUrl?: string | null, generatedAt: Date = new Date()): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new JsPDF({ orientation: "landscape" });

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", 14, 5, 22, 22); } catch { /* optional */ }
  }
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text("REGISTRO DE COTIZACIONES", 42, 16);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 80, 160);
  doc.text("Doji Print - Impresiones 3D", 42, 23); doc.setTextColor(0, 0, 0);
  doc.text(`Generado: ${generatedAt.toLocaleDateString("es-AR")} ${generatedAt.toLocaleTimeString("es-AR")}`, 230, 16);
  doc.text(`Total: ${views.length} cotizaciones`, 230, 22);
  doc.line(14, 30, 283, 30);

  autoTable(doc, {
    startY: 34,
    head: [["Fecha", "Cliente", "Pieza", "Canal", "Impresora", "Cant.", "Costo", "Precio final", "Margen", "Estado", "Responsable"]],
    body: views.map((v) => [
      new Date(v.created_at).toLocaleDateString("es-AR"), v.client_name, v.piece_name ?? "", channelLabel(v.channel),
      v.printer_name, String(v.quantity), formatCurrency(Number(v.total_cost)), formatCurrency(v.price),
      formatPercent(v.margin), STATUS_TEXT[v.status], v.user_name,
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 16, 84], fontSize: 8 },
    styles: { fontSize: 7.5 },
    columnStyles: { 5: { halign: "center" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
  });

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.text("Documento interno generado automáticamente - Doji Print", 148, pageHeight - 8, { align: "center" });
  return doc;
}
