"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { supabase, type Printer } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import {
  calculateLive, calculatorSchema, getPresetUpdates, marginPercent, toCalculationSnapshot,
  type CalculationSnapshot, type CalculatorFormValues, PRESET_COLUMNS, type PresetField,
} from "@/lib/calculator"
import { buildSnapshot } from "@/lib/quotation-meta"
import { emptyDraft, resolveFinalPrice, type QuoteDraft } from "@/lib/quote-draft"
import { BUSINESS_INFO_KEY, DEFAULT_BUSINESS_INFO, buildQuotationPdf, loadLogoDataUrl, quotationFileName, type BusinessInfo } from "@/lib/quotation-pdf"
import { formatCurrencyWhole } from "@/lib/format"
import type { QuotePrefill } from "@/lib/quote-prefill"
import { Form } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { PrinterStrip } from "@/components/quote/printer-strip"
import { PieceFields } from "@/components/quote/piece-fields"
import { PricePanel } from "@/components/quote/price-panel"
import { SaveQuote } from "@/components/quote/save-quote"
import { MobileSummaryBar } from "@/components/quote/mobile-summary-bar"
import { BusinessInfoDialog } from "@/components/quote/business-info-dialog"

const PRINTER_KEY = "3d-calc-printer"
const SNAPSHOT_DEBOUNCE_MS = 400

const pieceStorageKey = (printerId: string | null) => (printerId ? `3d-piece-${printerId}` : "3d-piece-default")

type Props = {
  /** Fires (debounced) with the latest valid calculation so other tabs can use it */
  onCalculated?: (snapshot: CalculationSnapshot) => void
  onNavigate?: (tab: "registry") => void
  /** A quotation to start from (duplicated in the registry); applied once per `key` */
  prefill?: QuotePrefill | null
}

export default function CalculatorForm({ onCalculated, onNavigate, prefill }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [printers, setPrinters] = useState<Printer[]>([])
  const [printersLoading, setPrintersLoading] = useState(true)
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null)
  const [savingPresets, setSavingPresets] = useState(false)
  const printersRef = useRef<Printer[]>([])

  const [draft, setDraft] = useState<QuoteDraft>(() => emptyDraft())
  const [savingQuotation, setSavingQuotation] = useState(false)
  const [savedSignature, setSavedSignature] = useState<string | null>(null)

  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(DEFAULT_BUSINESS_INFO)
  const [businessOpen, setBusinessOpen] = useState(false)
  const [saveSectionVisible, setSaveSectionVisible] = useState(false)
  // Set while a duplicated quotation waits for its printer to finish loading, and after it was applied
  const pendingPrefillRef = useRef<QuotePrefill | null>(null)
  const appliedPrefillKeyRef = useRef<number | null>(null)
  const [duplicatedFrom, setDuplicatedFrom] = useState<QuotePrefill["original"] | null>(null)

  const form = useForm<CalculatorFormValues>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: calculatorSchema.parse({}),
    mode: "onChange",
  })

  // Everything below derives from what is typed, live
  const watched = useWatch({ control: form.control })
  const results = useMemo(() => calculateLive(watched), [watched])
  const parsed = useMemo(() => calculatorSchema.safeParse(watched), [watched])
  const selectedPrinter = printers.find((p) => p.id === selectedPrinterId)
  const multiplier = parsed.success ? parsed.data.profitMultiplier : Number(watched.profitMultiplier) || 5

  // ---- printers -------------------------------------------------------------------------------------------
  useEffect(() => { printersRef.current = printers }, [printers])

  useEffect(() => {
    supabase.from("printers").select("*").order("name").then(({ data, error }) => {
      setPrintersLoading(false)
      if (error) {
        toast({ variant: "destructive", title: "No se pudieron cargar las impresoras", description: error.message })
        return
      }
      const list = (data ?? []) as Printer[]
      printersRef.current = list
      setPrinters(list)
      const saved = localStorage.getItem(PRINTER_KEY)
      if (saved && list.some((p) => p.id === saved)) setSelectedPrinterId(saved)
      else if (list.length > 0) setSelectedPrinterId(list[0].id)
    })
  }, [toast])

  // Selecting a printer loads its saved values; the piece fields come back from this browser's storage.
  // Depends on the selection only, so saving the shared values never resets what is being typed.
  const printersLoaded = printers.length > 0
  useEffect(() => {
    if (!selectedPrinterId) return
    const printer = printersRef.current.find((p) => p.id === selectedPrinterId)
    if (!printer) return
    let piece: Partial<CalculatorFormValues> = {}
    try {
      const raw = localStorage.getItem(pieceStorageKey(selectedPrinterId))
      if (raw) piece = JSON.parse(raw)
    } catch { localStorage.removeItem(pieceStorageKey(selectedPrinterId)) }
    // A duplicated quotation wins over what this browser remembered for the printer
    if (pendingPrefillRef.current) { piece = pendingPrefillRef.current.piece; pendingPrefillRef.current = null }

    form.reset({
      ...calculatorSchema.parse({}),
      ...presetValuesOf(printer),
      ...(piece.printTimeHours !== undefined && { printTimeHours: piece.printTimeHours }),
      ...(piece.printTimeMinutes !== undefined && { printTimeMinutes: piece.printTimeMinutes }),
      ...(piece.printWeightGrams !== undefined && { printWeightGrams: piece.printWeightGrams }),
      ...(piece.quantity !== undefined && { quantity: piece.quantity }),
      ...(piece.extraCosts !== undefined && { extraCosts: piece.extraCosts }),
      ...(piece.materialUsed !== undefined && { materialUsed: piece.materialUsed }),
      ...(piece.profitMultiplier !== undefined && { profitMultiplier: piece.profitMultiplier }),
    })
  }, [selectedPrinterId, printersLoaded, form])

  // Duplicate a quotation: its printer (if it still exists), piece and client data; the costs are today's saved ones
  useEffect(() => {
    if (!prefill || appliedPrefillKeyRef.current === prefill.key || printersRef.current.length === 0) return
    appliedPrefillKeyRef.current = prefill.key
    const printer = printersRef.current.find((p) => p.id === prefill.printerId)
    if (printer && printer.id !== selectedPrinterId) {
      pendingPrefillRef.current = prefill // the selection effect applies the piece
      setSelectedPrinterId(printer.id)
      try { localStorage.setItem(PRINTER_KEY, printer.id) } catch { /* storage unavailable */ }
    } else {
      const base = printer ?? printersRef.current.find((p) => p.id === selectedPrinterId)
      form.reset({ ...calculatorSchema.parse({}), ...(base ? presetValuesOf(base) : {}), ...prefill.piece })
    }
    setDraft({ ...emptyDraft(), ...prefill.draft })
    setSavedSignature(null)
    setDuplicatedFrom(prefill.original)
    window.scrollTo({ top: 0 })
  }, [prefill, printersLoaded, selectedPrinterId, form])

  // Keep this browser's piece data (the printer values live in the database, not here)
  useEffect(() => {
    const sub = form.watch((v) => {
      const piece = {
        printTimeHours: v.printTimeHours, printTimeMinutes: v.printTimeMinutes, printWeightGrams: v.printWeightGrams,
        quantity: v.quantity, extraCosts: v.extraCosts, materialUsed: v.materialUsed, profitMultiplier: v.profitMultiplier,
      }
      try { localStorage.setItem(pieceStorageKey(selectedPrinterId), JSON.stringify(piece)) } catch { /* storage unavailable */ }
    })
    return () => sub.unsubscribe()
  }, [form, selectedPrinterId])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BUSINESS_INFO_KEY)
      if (stored) setBusinessInfo({ ...DEFAULT_BUSINESS_INFO, ...JSON.parse(stored) })
    } catch { /* ignore a corrupt value */ }
  }, [])

  // ---- shared printer values: explicit save ---------------------------------------------------------------
  const presetUpdates = useMemo(
    () => (selectedPrinter ? getPresetUpdates(watched, selectedPrinter) : {}),
    [watched, selectedPrinter],
  )
  const changedCount = Object.keys(presetUpdates).length

  const savePresets = async () => {
    if (!selectedPrinter || changedCount === 0) return
    setSavingPresets(true)
    const { error } = await supabase.from("printers")
      .update({ ...presetUpdates, updated_at: new Date().toISOString() })
      .eq("id", selectedPrinter.id)
    setSavingPresets(false)
    if (error) {
      toast({ variant: "destructive", title: "No se pudieron guardar los valores", description: error.message })
      return
    }
    setPrinters((prev) => prev.map((p) => (p.id === selectedPrinter.id ? { ...p, ...presetUpdates } as Printer : p)))
    toast({ title: "Valores guardados", description: `${selectedPrinter.name} quedó actualizada para todo el equipo.` })
  }

  const discardPresets = () => {
    if (!selectedPrinter) return
    for (const [field, value] of Object.entries(presetValuesOf(selectedPrinter))) {
      form.setValue(field as PresetField, value, { shouldDirty: false })
    }
  }

  // ---- hand the live calculation to the AI tab -------------------------------------------------------------
  useEffect(() => {
    if (!results || !parsed.success || !onCalculated) return
    const timer = setTimeout(() => onCalculated(toCalculationSnapshot(parsed.data, results)), SNAPSHOT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [results, parsed, onCalculated])

  // ---- saving the quotation ---------------------------------------------------------------------------------
  const finalPrice = results ? resolveFinalPrice(draft, results.sellingPrice) : null

  // Same data => already saved; any change makes it a new quotation
  const currentSignature = useMemo(
    () => (results && parsed.success ? JSON.stringify([draft, finalPrice, selectedPrinterId, parsed.data]) : null),
    [draft, finalPrice, selectedPrinterId, results, parsed],
  )
  const saved = currentSignature !== null && currentSignature === savedSignature

  const saveQuotation = useCallback(async (): Promise<boolean> => {
    if (!results || !parsed.success || finalPrice === null || !user || !draft.clientName.trim()) return false
    if (currentSignature && currentSignature === savedSignature) return true
    const v = parsed.data
    setSavingQuotation(true)
    const { error } = await supabase.from("quotations").insert({
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email || "Desconocido",
      user_email: user.email,
      client_name: draft.clientName.trim(),
      client_contact: draft.clientContact.trim() || null,
      piece_name: draft.pieceName.trim() || null,
      piece_description: draft.pieceDescription.trim() || null,
      channel: draft.channel,
      printer_id: selectedPrinterId,
      printer_name: selectedPrinter?.name || "Sin impresora",
      material_used: v.materialUsed, print_weight_grams: v.printWeightGrams,
      print_time_hours: v.printTimeHours, print_time_minutes: v.printTimeMinutes,
      quantity: v.quantity, extra_costs: v.extraCosts, profit_multiplier: v.profitMultiplier,
      total_cost: results.totalCostWithSupplies,
      selling_price: results.sellingPrice,
      final_price: finalPrice,
      valid_until: draft.validUntil || null,
      internal_notes: draft.internalNotes.trim() || null,
      snapshot: buildSnapshot(v, results, { id: selectedPrinterId, name: selectedPrinter?.name || "Sin impresora" }),
      status: "pendiente",
    })
    setSavingQuotation(false)
    if (error) {
      console.error("Error al guardar la cotización:", error)
      toast({ variant: "destructive", title: "No se pudo guardar la cotización", description: error.message })
      return false
    }
    setSavedSignature(currentSignature)
    return true
  }, [results, parsed, finalPrice, user, draft, currentSignature, savedSignature, selectedPrinterId, selectedPrinter, toast])

  const downloadPdf = async () => {
    if (!results || finalPrice === null) return
    try {
      const doc = await buildQuotationPdf({
        clientName: draft.clientName.trim(),
        clientContact: draft.clientContact.trim() || undefined,
        pieceName: draft.pieceName.trim() || undefined,
        materialUsed: parsed.success ? parsed.data.materialUsed : undefined,
        printerName: selectedPrinter?.name,
        quantity: results.quantity,
        finalPrice,
        pricePerUnit: finalPrice / results.quantity,
        validUntil: draft.validUntil || undefined,
        business: businessInfo,
      }, await loadLogoDataUrl())
      doc.save(quotationFileName(draft.clientName, draft.pieceName))
    } catch (error) {
      console.error("Error al generar el PDF:", error)
      toast({ variant: "destructive", title: "No se pudo generar el PDF", description: error instanceof Error ? error.message : undefined })
    }
  }

  const handleSave = async (alsoPdf: boolean) => {
    const ok = await saveQuotation()
    if (ok && alsoPdf) await downloadPdf()
  }

  // ---- misc handlers ------------------------------------------------------------------------------------------
  const handlePrinterChange = (id: string) => {
    setSelectedPrinterId(id)
    try { localStorage.setItem(PRINTER_KEY, id) } catch { /* storage unavailable */ }
  }

  const clearPiece = () => {
    // The weight is left empty on purpose: a fresh quotation shows no price until it is filled in
    form.setValue("printWeightGrams", "" as unknown as number, { shouldValidate: false })
    form.setValue("printTimeHours", 0)
    form.setValue("printTimeMinutes", 0)
    form.setValue("quantity", 1)
    form.setValue("extraCosts", 0)
    setDraft(emptyDraft())
    setSavedSignature(null)
  }

  const startNew = () => {
    clearPiece()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const saveBusinessInfo = (info: BusinessInfo) => {
    setBusinessInfo(info)
    try { localStorage.setItem(BUSINESS_INFO_KEY, JSON.stringify(info)) } catch { /* storage unavailable */ }
    setBusinessOpen(false)
    toast({ title: "Datos guardados" })
  }

  const goToSave = () => document.getElementById("guardar")?.scrollIntoView({ behavior: "smooth", block: "start" })

  // Hide the phone bar while the save section is on screen
  useEffect(() => {
    const el = document.getElementById("guardar")
    if (!el || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => setSaveSectionVisible(entry.isIntersecting), { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const margin = results ? marginPercent(results.sellingPrice, results.totalCostWithSupplies) : 0

  return (
    <div className="mx-auto w-full max-w-6xl pb-28 lg:pb-0">
      {duplicatedFrom && (
        <div role="status" className="mb-4 flex flex-col gap-2 rounded-lg bg-secondary/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular-nums">
            Duplicada de la cotización de <strong>{duplicatedFrom.clientName}</strong> del {new Date(duplicatedFrom.createdAt).toLocaleDateString("es-AR")}.
            Se cotizó a <strong>{formatCurrencyWhole(duplicatedFrom.price)}</strong>
            {results && <> y con los costos de hoy el precio calculado es <strong>{formatCurrencyWhole(results.sellingPrice)}</strong></>}.
          </p>
          <button type="button" className="shrink-0 text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground" onClick={() => setDuplicatedFrom(null)}>Ocultar</button>
        </div>
      )}
      <Form {...form}>
        {/* Phone: printer, piece, price, save. Desktop: inputs and saving on the left, the price always in view on the right. */}
        <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-x-6">
          <div className="space-y-4 lg:col-start-1">
            <PrinterStrip
              form={form}
              printers={printers}
              loading={printersLoading}
              selectedId={selectedPrinterId}
              onSelect={handlePrinterChange}
              changedCount={changedCount}
              saving={savingPresets}
              onSave={savePresets}
              onDiscard={discardPresets}
            />
            <PieceFields form={form} onClear={clearPiece} />
          </div>

          <aside className="rounded-lg border bg-card p-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <PricePanel
              results={results}
              multiplier={multiplier}
              printTimeHours={parsed.success ? parsed.data.printTimeHours : Number(watched.printTimeHours) || 0}
              printTimeMinutes={parsed.success ? parsed.data.printTimeMinutes : Number(watched.printTimeMinutes) || 0}
              onMultiplierChange={(m) => form.setValue("profitMultiplier", m, { shouldValidate: true })}
            />
          </aside>

          <div className="rounded-lg border bg-card p-5 lg:col-start-1">
            <SaveQuote
              results={results}
              draft={draft}
              onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              businessName={businessInfo.businessName}
              onEditBusiness={() => setBusinessOpen(true)}
              saving={savingQuotation}
              saved={saved}
              onSave={handleSave}
              onPdfOnly={downloadPdf}
              onGoToRegistry={() => onNavigate?.("registry")}
              onNew={startNew}
            />
          </div>
        </form>
      </Form>

      {results && !saveSectionVisible && <MobileSummaryBar price={results.sellingPrice} margin={margin} onSave={goToSave} />}
      <BusinessInfoDialog open={businessOpen} onOpenChange={setBusinessOpen} businessInfo={businessInfo} onSave={saveBusinessInfo} />
    </div>
  )
}

/** The six shared printer values as form values */
function presetValuesOf(printer: Printer): Pick<CalculatorFormValues, PresetField> {
  const values = {} as Record<string, number>
  const columns = PRESET_COLUMNS as Record<string, keyof Printer>
  for (const [field, column] of Object.entries(columns)) values[field] = Number(printer[column])
  return values as Pick<CalculatorFormValues, PresetField>
}
