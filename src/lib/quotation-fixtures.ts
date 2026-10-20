import type { QuotationListItem } from "@/lib/quotation-view";

/** Builds a list item with sensible defaults; override what the test or preview cares about. */
export function makeItem(over: Partial<QuotationListItem> = {}): QuotationListItem {
  return {
    id: over.id ?? `q-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "u1",
    user_name: "Nahuel",
    user_email: "kelmnahuel@gmail.com",
    client_name: "Cliente",
    client_contact: null,
    piece_name: null,
    piece_description: null,
    channel: "directo",
    printer_id: "p-a1",
    printer_name: "Bambu Lab A1",
    material_used: "PLA",
    print_weight_grams: 100,
    print_time_hours: 2,
    print_time_minutes: 0,
    quantity: 1,
    extra_costs: 0,
    profit_multiplier: 4,
    total_cost: 2500,
    selling_price: 10000,
    final_price: 10000,
    status: "pendiente",
    lost_reason: null,
    decided_at: null,
    valid_until: null,
    internal_notes: null,
    created_at: "2026-10-15T15:00:00.000Z",
    updated_at: "2026-10-15T15:00:00.000Z",
    ...over,
  };
}

/** A believable month of activity for the shop's three printers (used by tests and the visual preview). */
export function sampleQuotations(): QuotationListItem[] {
  return [
    makeItem({ id: "s1", client_name: "María Fernández", piece_name: "Llavero dragón articulado", channel: "instagram", printer_name: "Bambu Lab A1", material_used: "PLA", quantity: 20, total_cost: 14000, selling_price: 56000, final_price: 52000, status: "aprobada", decided_at: "2026-10-16T12:00:00.000Z", print_time_hours: 1, print_time_minutes: 30, created_at: "2026-10-14T14:00:00.000Z" }),
    makeItem({ id: "s2", client_name: "Estudio Nómade", piece_name: "Soporte de monitor", channel: "directo", printer_name: "Bambu Lab P1S", material_used: "PETG", quantity: 2, total_cost: 9800, selling_price: 39200, final_price: 39200, status: "aprobada", decided_at: "2026-10-12T12:00:00.000Z", print_time_hours: 6, print_time_minutes: 0, created_at: "2026-10-11T10:00:00.000Z" }),
    makeItem({ id: "s3", client_name: "Tomás Rey", piece_name: "Engranaje de repuesto", channel: "mercadolibre", printer_name: "Bambu Lab P1S", material_used: "ABS", quantity: 1, total_cost: 3100, selling_price: 12400, final_price: 12400, status: "rechazada", lost_reason: "caro", decided_at: "2026-10-10T12:00:00.000Z", print_time_hours: 3, print_time_minutes: 0, created_at: "2026-10-09T10:00:00.000Z" }),
    makeItem({ id: "s4", client_name: "Café Martínez", piece_name: "Posavasos con logo (x50)", channel: "whatsapp", printer_name: "Snapmaker U1", material_used: "PLA", quantity: 50, total_cost: 38000, selling_price: 152000, final_price: 140000, status: "pendiente", valid_until: "2026-10-28", print_time_hours: 0, print_time_minutes: 40, created_at: "2026-10-18T09:00:00.000Z" }),
    makeItem({ id: "s5", client_name: "Lucía Paz", piece_name: "Figura personalizada", channel: "instagram", printer_name: "Snapmaker U1", material_used: "PLA", quantity: 1, total_cost: 5200, selling_price: 20800, final_price: 20800, status: "rechazada", lost_reason: "tardanza", decided_at: "2026-10-05T12:00:00.000Z", print_time_hours: 5, print_time_minutes: 0, created_at: "2026-10-03T10:00:00.000Z" }),
    makeItem({ id: "s6", client_name: "María Fernández", piece_name: "Llavero con nombre", channel: "instagram", printer_name: "Bambu Lab A1", material_used: "PLA", quantity: 10, total_cost: 5000, selling_price: 20000, final_price: 20000, status: "aprobada", decided_at: "2026-09-21T12:00:00.000Z", print_time_hours: 1, print_time_minutes: 0, created_at: "2026-09-20T10:00:00.000Z" }),
    makeItem({ id: "s7", client_name: "Ferretería Sur", piece_name: "Clips de cable", channel: "directo", printer_name: "Bambu Lab A1", material_used: "TPU", quantity: 100, total_cost: 21000, selling_price: 84000, final_price: 70000, status: "rechazada", lost_reason: "competencia", decided_at: "2026-09-02T12:00:00.000Z", print_time_hours: 0, print_time_minutes: 25, created_at: "2026-09-01T10:00:00.000Z" }),
    makeItem({ id: "s8", client_name: "Taller Ruiz", piece_name: "Carcasa Arduino", channel: "directo", printer_name: "Bambu Lab P1S", material_used: "PETG", quantity: 3, total_cost: 8400, selling_price: 33600, final_price: 33600, status: "aprobada", decided_at: "2026-08-20T12:00:00.000Z", print_time_hours: 2, print_time_minutes: 30, created_at: "2026-08-19T10:00:00.000Z" }),
  ];
}
