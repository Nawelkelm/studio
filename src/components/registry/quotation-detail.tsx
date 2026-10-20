"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Copy, FileDown, Loader2, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyWhole, formatPercent } from "@/lib/format";
import { CHANNELS, LOST_REASONS, channelLabel, formatDateOnly, lostReasonLabel, type Channel, type LostReason, type QuotationSnapshot } from "@/lib/quotation-meta";
import { resolveFinalPrice } from "@/lib/quote-draft";
import type { QuotationEdit, QuotationView } from "@/lib/quotation-view";
import type { Quotation } from "@/lib/supabase";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, statusLabel } from "@/components/registry/status-badge";

type Status = Quotation["status"];
const STATUSES: Status[] = ["pendiente", "aprobada", "rechazada"];

type Props = {
  view: QuotationView | null;
  /** Open straight into the rejection reason picker */
  startRejecting?: boolean;
  onClose: () => void;
  onSetStatus: (id: string, status: Status, lostReason?: LostReason) => Promise<boolean>;
  onUpdate: (id: string, patch: QuotationEdit) => Promise<boolean>;
  onLoadSnapshot: (id: string) => Promise<QuotationSnapshot | null>;
  onDuplicate: (view: QuotationView) => void;
  onPdf: (view: QuotationView) => Promise<void> | void;
};

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function QuotationDetail({ view, startRejecting = false, onClose, onSetStatus, onUpdate, onLoadSnapshot, onDuplicate, onPdf }: Props) {
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<LostReason | null>(null);
  const [busy, setBusy] = useState(false);

  // Start fresh for every quotation that is opened
  const id = view?.id ?? null;
  useEffect(() => {
    setEditing(false);
    setRejecting(startRejecting);
    setReason(null);
  }, [id, startRejecting]);

  const changeStatus = async (status: Status) => {
    if (!view || status === view.status) return;
    if (status === "rechazada") { setRejecting(true); return; }
    setBusy(true);
    await onSetStatus(view.id, status);
    setBusy(false);
  };

  const confirmRejection = async () => {
    if (!view || !reason) return;
    setBusy(true);
    const ok = await onSetStatus(view.id, "rechazada", reason);
    setBusy(false);
    if (ok) setRejecting(false);
  };

  return (
    <Sheet open={view !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        // Don't autofocus the first control (it would look like the selected status); focus stays on the panel
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn("overflow-y-auto", isMobile ? "max-h-[92vh] rounded-t-xl" : "w-full sm:max-w-lg")}
      >
        {view && (
          <div className="space-y-6 pb-4">
            <SheetHeader className="text-left">
              <SheetTitle className="pr-6">{view.client_name}</SheetTitle>
              <SheetDescription>
                {view.piece_name || "Sin nombre de pieza"} · {new Date(view.created_at).toLocaleDateString("es-AR")}
              </SheetDescription>
            </SheetHeader>

            <section aria-label="Precio" className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Precio final</p>
                <p className="text-3xl font-bold tabular-nums">{formatCurrencyWhole(view.price)}</p>
                {Math.abs(view.discount) >= 0.05 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Calculado {formatCurrencyWhole(Number(view.selling_price))} ·{" "}
                    {view.discount > 0 ? `${formatPercent(view.discount)} menos` : `${formatPercent(-view.discount)} más`}
                  </p>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-3 border-y py-3">
                <div><dt className="text-xs text-muted-foreground">Margen</dt><dd className="font-semibold tabular-nums">{formatPercent(view.margin)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Ganancia</dt><dd className="font-semibold tabular-nums">{formatCurrencyWhole(view.profit)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Por hora</dt><dd className="font-semibold tabular-nums">{view.profitPerHour === null ? "—" : `${formatCurrencyWhole(view.profitPerHour)}/h`}</dd></div>
              </dl>
            </section>

            <section aria-labelledby="status-heading" className="space-y-3">
              <h3 id="status-heading" className="text-sm font-semibold">Estado</h3>
              <div role="radiogroup" aria-labelledby="status-heading" className="grid grid-cols-3 gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={view.status === s}
                    disabled={busy}
                    onClick={() => void changeStatus(s)}
                    className={cn(
                      "min-h-11 rounded-md border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                      view.status === s ? "border-primary bg-primary/15 font-semibold" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <StatusBadge status={view.status} expired={view.isExpired} />
                {view.decided_at && <span>Decidida el {dateTime(view.decided_at)}</span>}
              </div>

              {view.status === "rechazada" && view.lost_reason && !rejecting && (
                <p className="text-sm">
                  Motivo: <strong>{lostReasonLabel(view.lost_reason)}</strong>{" "}
                  <button type="button" className="ml-1 text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground" onClick={() => { setReason(view.lost_reason); setRejecting(true); }}>Cambiar</button>
                </p>
              )}
              {view.status === "rechazada" && !view.lost_reason && !rejecting && (
                <p className="text-sm text-muted-foreground">
                  Sin motivo registrado.{" "}
                  <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setRejecting(true)}>Agregar motivo</button>
                </p>
              )}

              {rejecting && (
                <div className="space-y-3 rounded-md bg-secondary/50 p-3">
                  <p id="reason-heading" className="text-sm font-medium">¿Por qué se perdió?</p>
                  <div role="radiogroup" aria-labelledby="reason-heading" className="flex flex-wrap gap-2">
                    {LOST_REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={reason === r.value}
                        onClick={() => setReason(r.value)}
                        className={cn(
                          "min-h-9 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          reason === r.value ? "border-primary bg-primary/15 font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={!reason || busy} onClick={() => void confirmRejection()} className="gap-1.5">
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {view.status === "rechazada" ? "Guardar motivo" : "Confirmar rechazo"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </section>

            {editing ? (
              <EditForm view={view} onCancel={() => setEditing(false)} onSave={async (patch) => { const ok = await onUpdate(view.id, patch); if (ok) setEditing(false); return ok; }} />
            ) : (
              <section aria-labelledby="data-heading">
                <div className="flex items-center justify-between">
                  <h3 id="data-heading" className="text-sm font-semibold">Datos</h3>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                </div>
                <dl className="divide-y">
                  <Field label="Canal">{channelLabel(view.channel)}</Field>
                  <Field label="Contacto">{view.client_contact || "—"}</Field>
                  <Field label="Vigencia">
                    {view.valid_until ? formatDateOnly(view.valid_until) : "—"}{view.isExpired && <span className="ml-2 text-xs text-orange-300">vencida</span>}
                  </Field>
                  <Field label="Impresora">{view.printer_name}</Field>
                  <Field label="Pieza">
                    <span className="tabular-nums">{view.quantity} u. · {view.material_used} · {Number(view.print_weight_grams)} g · {view.print_time_hours} h {view.print_time_minutes} min</span>
                  </Field>
                  {view.piece_description && <Field label="Descripción">{view.piece_description}</Field>}
                  {view.internal_notes && <Field label="Notas internas"><span className="whitespace-pre-wrap">{view.internal_notes}</span></Field>}
                  <Field label="Hecha por">{view.user_name}</Field>
                </dl>
              </section>
            )}

            <Breakdown view={view} onLoadSnapshot={onLoadSnapshot} />

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="button" className="gap-2" onClick={() => onDuplicate(view)}><Copy className="h-4 w-4" /> Duplicar en el cotizador</Button>
              <Button type="button" variant="outline" className="gap-2" onClick={() => void onPdf(view)}><FileDown className="h-4 w-4" /> Descargar PDF</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({ view, onCancel, onSave }: { view: QuotationView; onCancel: () => void; onSave: (patch: QuotationEdit) => Promise<boolean> }) {
  const [piece, setPiece] = useState(view.piece_name ?? "");
  const [description, setDescription] = useState(view.piece_description ?? "");
  const [contact, setContact] = useState(view.client_contact ?? "");
  const [channel, setChannel] = useState<Channel>(view.channel);
  const [price, setPrice] = useState(String(Math.round(view.price * 100) / 100).replace(".", ","));
  const [validUntil, setValidUntil] = useState(view.valid_until ?? "");
  const [notes, setNotes] = useState(view.internal_notes ?? "");
  const [saving, setSaving] = useState(false);

  const finalPrice = resolveFinalPrice({ finalPriceInput: price }, Number(view.selling_price));

  const save = async () => {
    if (finalPrice === null) return;
    setSaving(true);
    await onSave({
      piece_name: piece.trim() || null,
      piece_description: description.trim() || null,
      client_contact: contact.trim() || null,
      channel,
      final_price: finalPrice,
      valid_until: validUntil || null,
      internal_notes: notes.trim() || null,
    });
    setSaving(false);
  };

  return (
    <section aria-labelledby="edit-heading" className="space-y-3">
      <h3 id="edit-heading" className="text-sm font-semibold">Editar datos</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="e-piece">Pieza</Label><Input id="e-piece" value={piece} maxLength={120} onChange={(e) => setPiece(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="e-contact">Contacto</Label><Input id="e-contact" value={contact} maxLength={120} onChange={(e) => setContact(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="e-channel">Canal</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
            <SelectTrigger id="e-channel"><SelectValue /></SelectTrigger>
            <SelectContent>{CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-price">Precio final</Label>
          <Input id="e-price" inputMode="decimal" className="tabular-nums" aria-invalid={finalPrice === null} value={price} onChange={(e) => setPrice(e.target.value)} />
          {finalPrice === null && <p className="text-xs text-red-400">No es un monto válido.</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="e-valid">Válida hasta</Label><Input id="e-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="e-desc">Descripción de la pieza</Label><Textarea id="e-desc" rows={2} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="e-notes">Notas internas</Label><Textarea id="e-notes" rows={3} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={saving || finalPrice === null} onClick={() => void save()} className="gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar cambios
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>Cancelar</Button>
      </div>
    </section>
  );
}

/** Internal cost breakdown: loaded only when opened (the snapshot is not part of the list). */
function Breakdown({ view, onLoadSnapshot }: { view: QuotationView; onLoadSnapshot: Props["onLoadSnapshot"] }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [snapshot, setSnapshot] = useState<QuotationSnapshot | null>(null);

  useEffect(() => { setOpen(false); setState("idle"); setSnapshot(null); }, [view.id]);

  const toggle = async (next: boolean) => {
    setOpen(next);
    if (next && state === "idle") {
      setState("loading");
      setSnapshot(await onLoadSnapshot(view.id));
      setState("done");
    }
  };

  const r = snapshot?.results;
  const rows: [string, number][] = r
    ? [["Material", r.materialCost], ["Electricidad", r.electricityCost], ["Amortización", r.depreciationCost], ["Margen de error", r.errorMarginCost], ["Adicionales", r.suppliesCost]]
    : [];

  return (
    <Collapsible open={open} onOpenChange={(v) => void toggle(v)} className="border-t pt-3">
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Costos de esta cotización <span className="text-xs font-normal text-muted-foreground">(internos)</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {state === "loading" && <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
        {state === "done" && !snapshot && (
          <p className="text-sm text-muted-foreground">
            Esta cotización es anterior al registro de costos: solo se conserva el costo total, <span className="tabular-nums text-foreground">{formatCurrency(Number(view.total_cost))}</span>.
          </p>
        )}
        {snapshot && r && (
          <div className="space-y-3">
            <dl className="space-y-1.5 text-sm tabular-nums">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd>{formatCurrency(value)}</dd></div>
              ))}
              <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Costo total</dt><dd>{formatCurrency(r.totalCostWithSupplies)}</dd></div>
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground tabular-nums">
              Con los valores de {snapshot.printer.name} de ese momento: filamento {formatCurrencyWhole(snapshot.inputs.filamentCostPerKg)}/kg · luz {formatCurrencyWhole(snapshot.inputs.electricityCostKwh)}/kWh ·
              {" "}{snapshot.inputs.printerPower} W · máquina {formatCurrencyWhole(snapshot.inputs.printerCost)} · vida útil {snapshot.inputs.printerLifespan} h · fallos {snapshot.inputs.failureRatePercent}%.
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
