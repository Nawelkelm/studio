"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { downloadTextFile } from "@/lib/download";
import { prefillFromQuotation, type QuotePrefill } from "@/lib/quote-prefill";
import { buildQuotationPdf, loadLogoDataUrl, quotationFileName, readBusinessInfo } from "@/lib/quotation-pdf";
import type { QuotationSnapshot } from "@/lib/quotation-meta";
import { buildRegistryPdf } from "@/lib/registry-pdf";
import { quotationsToCsv, type QuotationEdit, type QuotationListItem, type QuotationView } from "@/lib/quotation-view";
import { RegistryView, type RegistryActions } from "@/components/registry/registry-view";

// Everything except `snapshot` (loaded on demand in the detail) and the legacy `notes` JSON
const LIST_COLUMNS = [
  "id", "created_at", "updated_at", "user_id", "user_name", "user_email", "client_name", "client_contact", "piece_name",
  "piece_description", "channel", "printer_id", "printer_name", "material_used", "print_weight_grams", "print_time_hours",
  "print_time_minutes", "quantity", "extra_costs", "profit_multiplier", "total_cost", "selling_price", "final_price", "status",
  "lost_reason", "decided_at", "valid_until", "internal_notes",
].join(",");

type Props = {
  onDuplicate: (prefill: QuotePrefill) => void;
  onGoToCalculator: () => void;
};

export default function QuotationRegistry({ onDuplicate, onGoToCalculator }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<QuotationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("quotations").select(LIST_COLUMNS).order("created_at", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "No se pudieron cargar las cotizaciones", description: error.message });
    } else {
      setItems((data ?? []) as unknown as QuotationListItem[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { if (user) void refresh(); }, [user, refresh]);

  const fail = (title: string, message: string) => {
    toast({ variant: "destructive", title, description: message });
    return false;
  };

  const actions: RegistryActions = {
    refresh: () => void refresh(),

    setStatus: async (id, status, lostReason) => {
      const { error } = await supabase.from("quotations").update({ status, lost_reason: status === "rechazada" ? lostReason ?? null : null }).eq("id", id);
      if (error) return fail("No se pudo cambiar el estado", error.message);
      toast({ title: "Estado actualizado" });
      await refresh();
      return true;
    },

    update: async (id, patch: QuotationEdit) => {
      const { error } = await supabase.from("quotations").update(patch).eq("id", id);
      if (error) return fail("No se pudieron guardar los cambios", error.message);
      toast({ title: "Cambios guardados" });
      await refresh();
      return true;
    },

    loadSnapshot: async (id) => {
      const { data, error } = await supabase.from("quotations").select("snapshot").eq("id", id).maybeSingle();
      if (error) { fail("No se pudo cargar el detalle de costos", error.message); return null; }
      const snapshot = data?.snapshot as QuotationSnapshot | null | undefined;
      return snapshot && snapshot.v === 1 && snapshot.results && snapshot.inputs ? snapshot : null;
    },

    duplicate: (view) => {
      onDuplicate(prefillFromQuotation(view, Date.now()));
      toast({ title: "Cotización duplicada", description: "Revisá el precio: usa los costos de hoy." });
    },

    downloadPdf: async (view: QuotationView) => {
      try {
        const doc = await buildQuotationPdf({
          clientName: view.client_name,
          clientContact: view.client_contact ?? undefined,
          pieceName: view.piece_name ?? undefined,
          materialUsed: view.material_used,
          printerName: view.printer_name,
          quantity: view.quantity,
          finalPrice: view.price,
          pricePerUnit: view.price / Math.max(1, view.quantity),
          validUntil: view.valid_until ?? undefined,
          business: readBusinessInfo(),
          date: new Date(view.created_at),
        }, await loadLogoDataUrl());
        doc.save(quotationFileName(view.client_name, view.piece_name ?? undefined));
      } catch (error) {
        fail("No se pudo generar el PDF", error instanceof Error ? error.message : "Error desconocido");
      }
    },

    exportPdf: (views) => {
      void (async () => {
        try {
          const doc = await buildRegistryPdf(views, await loadLogoDataUrl());
          doc.save(`Registro-Cotizaciones-${new Date().toISOString().split("T")[0]}.pdf`);
        } catch (error) {
          fail("No se pudo generar el PDF", error instanceof Error ? error.message : "Error desconocido");
        }
      })();
    },

    exportCsv: (views) => downloadTextFile(`Cotizaciones-${new Date().toISOString().split("T")[0]}.csv`, quotationsToCsv(views)),

    goToCalculator: onGoToCalculator,
  };

  return <RegistryView items={items} loading={loading} actions={actions} />;
}
