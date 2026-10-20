"use client";

import { ChevronDown, CheckCircle2, FileDown, Loader2, Save } from "lucide-react";

import { formatCurrencyWhole } from "@/lib/format";
import { CHANNELS, discountPercent, type Channel } from "@/lib/quotation-meta";
import { resolveFinalPrice, saveBlocker, type QuoteDraft } from "@/lib/quote-draft";
import type { CalculationResults } from "@/lib/calculator";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  results: CalculationResults | null;
  draft: QuoteDraft;
  onDraftChange: (patch: Partial<QuoteDraft>) => void;
  businessName: string;
  onEditBusiness: () => void;
  saving: boolean;
  /** The quotation as it is now has already been saved */
  saved: boolean;
  onSave: (alsoPdf: boolean) => void;
  onPdfOnly: () => void;
  onGoToRegistry: () => void;
  onNew: () => void;
};

export function SaveQuote({
  results, draft, onDraftChange, businessName, onEditBusiness, saving, saved, onSave, onPdfOnly, onGoToRegistry, onNew,
}: Props) {
  const finalPrice = results ? resolveFinalPrice(draft, results.sellingPrice) : null;
  const blocker = saveBlocker(draft, results !== null, finalPrice);
  const discount = results && finalPrice !== null ? discountPercent(results.sellingPrice, finalPrice) : 0;
  const differs = results !== null && draft.finalPriceInput !== null && Math.abs(discount) >= 0.05;
  const busy = saving || blocker !== null;

  return (
    <section id="guardar" aria-labelledby="save-heading" className="space-y-4 scroll-mt-4">
      <h2 id="save-heading" className="text-sm font-semibold">Guardar cotización</h2>

      {saved && (
        <div role="status" className="flex flex-col gap-2 rounded-md bg-green-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" /> Guardada en el registro de cotizaciones.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onGoToRegistry}>Ver cotizaciones</Button>
            <Button type="button" size="sm" variant="ghost" onClick={onNew}>Nueva cotización</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quote-client">Cliente</Label>
          <Input id="quote-client" autoComplete="off" value={draft.clientName} onChange={(e) => onDraftChange({ clientName: e.target.value })} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-piece">Pieza <span className="font-normal text-muted-foreground">(opcional)</span></Label>
          <Input id="quote-piece" autoComplete="off" placeholder="Ej: Llavero dragón" value={draft.pieceName} onChange={(e) => onDraftChange({ pieceName: e.target.value })} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-channel">Canal de venta</Label>
          <Select value={draft.channel} onValueChange={(v) => onDraftChange({ channel: v as Channel })}>
            <SelectTrigger id="quote-channel"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-final">Precio final a cobrar</Label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              id="quote-final"
              inputMode="decimal"
              className="pl-7 tabular-nums"
              aria-invalid={results !== null && finalPrice === null}
              value={draft.finalPriceInput ?? (results ? String(Math.round(results.sellingPrice)) : "")}
              onChange={(e) => onDraftChange({ finalPriceInput: e.target.value })}
              disabled={!results}
            />
          </div>
          {differs && (
            <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
              <span>
                {discount > 0 ? `${Math.abs(discount).toFixed(1).replace(".", ",")}% menos` : `${Math.abs(discount).toFixed(1).replace(".", ",")}% más`} que el calculado ({formatCurrencyWhole(results!.sellingPrice)})
              </span>
              <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => onDraftChange({ finalPriceInput: null })}>
                Usar el calculado
              </button>
            </p>
          )}
        </div>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-1.5 rounded-md py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" /> Más datos: contacto, vigencia, notas
        </CollapsibleTrigger>
        <CollapsibleContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="quote-contact">Contacto del cliente</Label>
            <Input id="quote-contact" autoComplete="off" placeholder="Teléfono o email" value={draft.clientContact} onChange={(e) => onDraftChange({ clientContact: e.target.value })} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote-valid">Válida hasta</Label>
            <Input id="quote-valid" type="date" value={draft.validUntil} onChange={(e) => onDraftChange({ validUntil: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quote-description">Descripción de la pieza</Label>
            <Textarea id="quote-description" rows={2} placeholder="Medidas, color, acabado…" value={draft.pieceDescription} onChange={(e) => onDraftChange({ pieceDescription: e.target.value })} maxLength={500} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quote-notes">Notas internas <span className="font-normal text-muted-foreground">(no salen en el PDF)</span></Label>
            <Textarea id="quote-notes" rows={2} value={draft.internalNotes} onChange={(e) => onDraftChange({ internalNotes: e.target.value })} maxLength={1000} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1 gap-2" disabled={busy} aria-describedby={blocker ? "save-blocker" : undefined} onClick={() => onSave(true)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Guardar y descargar PDF
          </Button>
          <Button type="button" variant="outline" className="gap-2" disabled={busy} aria-describedby={blocker ? "save-blocker" : undefined} onClick={() => onSave(false)}>
            <Save className="h-4 w-4" /> Guardar
          </Button>
        </div>
        {blocker && <p id="save-blocker" className="text-xs text-muted-foreground">{blocker}</p>}
        <p className="text-xs text-muted-foreground">
          El PDF sale a nombre de <span className="text-foreground">{businessName}</span> y no muestra costos internos.{" "}
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={onEditBusiness}>Cambiar datos</button>
          {" · "}
          <button type="button" className="underline underline-offset-2 hover:text-foreground disabled:opacity-50 disabled:no-underline" disabled={blocker !== null} onClick={onPdfOnly}>
            Solo PDF, sin guardar
          </button>
        </p>
      </div>
    </section>
  );
}
