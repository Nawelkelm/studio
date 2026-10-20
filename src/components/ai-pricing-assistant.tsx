"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Check, Loader2, RotateCcw, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrencyWhole, formatPercent } from "@/lib/format"
import type { CalculationResults, CalculatorFormValues } from "@/lib/calculator"
import { advisorBlocker, buildAdvisorRequest, requestSuggestion, tierMetrics, type SuggestionFetcher } from "@/lib/price-advisor"
import { STRATEGIES, STRATEGY_LABELS, type PricingResponse, type Strategy } from "@/lib/pricing-prompt"
import type { QuoteDraft } from "@/lib/quote-draft"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PriceLadder } from "@/components/quote/price-ladder"

const defaultFetcher: SuggestionFetcher = (request) =>
  requestSuggestion(request, async () => (await supabase.auth.getSession()).data.session?.access_token ?? null)

type Tier = "minimo" | "recomendado" | "premium"
const TIERS: { key: Tier; label: string; hint: string }[] = [
  { key: "minimo", label: "Mínimo", hint: "Lo más bajo que conviene aceptar" },
  { key: "recomendado", label: "Recomendado", hint: "Equilibra margen y probabilidad de venta" },
  { key: "premium", label: "Premium", hint: "Si el cliente valora calidad o personalización" },
]

type Props = {
  results: CalculationResults | null
  /** Validated form values (null while something is invalid) */
  values: CalculatorFormValues | null
  draft: QuoteDraft
  onDraftChange: (patch: Partial<QuoteDraft>) => void
  /** Apply a per-unit price to the quotation */
  onApplyPrice: (pricePerUnit: number) => void
  /** Injectable for previews and tests; defaults to the real API */
  fetchSuggestion?: SuggestionFetcher
}

type Phase = { name: "idle" } | { name: "loading" } | { name: "error"; message: string } | { name: "done"; response: PricingResponse; askedWith: string }

/** Asks the AI for a price range grounded in the shop's own cost and its closed quotations. */
export function PriceAdvisor({ results, values, draft, onDraftChange, onApplyPrice, fetchSuggestion = defaultFetcher }: Props) {
  const [strategy, setStrategy] = useState<Strategy>("balanced")
  const [phase, setPhase] = useState<Phase>({ name: "idle" })
  const [applied, setApplied] = useState<Tier | null>(null)

  const request = useMemo(() => buildAdvisorRequest({ values, results, draft, strategy }), [values, results, draft, strategy])
  const blocker = advisorBlocker(draft, results !== null)
  // The piece data the answer was based on; if it changes afterwards the answer may be out of date
  const currentKey = request ? JSON.stringify({ ...request, strategy: undefined }) : ""
  const stale = phase.name === "done" && phase.askedWith !== currentKey

  const ask = async (nextStrategy: Strategy = strategy) => {
    const asking = buildAdvisorRequest({ values, results, draft, strategy: nextStrategy })
    if (!asking) return
    setStrategy(nextStrategy)
    setApplied(null)
    setPhase({ name: "loading" })
    try {
      const response = await fetchSuggestion(asking)
      setPhase({ name: "done", response, askedWith: JSON.stringify({ ...asking, strategy: undefined }) })
    } catch (error) {
      setPhase({ name: "error", message: error instanceof Error ? error.message : "No se pudo obtener la sugerencia." })
    }
  }

  const loading = phase.name === "loading"

  return (
    <section aria-labelledby="advisor-heading" className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 id="advisor-heading" className="text-sm font-semibold">Asesor de precio con IA</h2>
      </div>

      {phase.name !== "done" && (
        <p className="text-sm text-muted-foreground">
          Mira tu costo real y las cotizaciones parecidas que ya cerraste, y te propone un rango de precio por unidad.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="advisor-piece">Pieza</Label>
        <Input
          id="advisor-piece"
          autoComplete="off"
          placeholder="Ej: Llavero dragón articulado"
          maxLength={120}
          value={draft.pieceName}
          onChange={(e) => onDraftChange({ pieceName: e.target.value })}
        />
      </div>

      <StrategyPicker value={strategy} onChange={(s) => (phase.name === "done" ? void ask(s) : setStrategy(s))} disabled={loading} />

      {phase.name !== "done" && (
        <div className="space-y-2">
          <Button type="button" className="gap-2" disabled={loading || blocker !== null} aria-describedby={blocker ? "advisor-blocker" : undefined} onClick={() => void ask()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analizando…" : "Pedir sugerencia"}
          </Button>
          {blocker && !loading && <p id="advisor-blocker" className="text-xs text-muted-foreground">{blocker}</p>}
        </div>
      )}

      {loading && (
        <div role="status" className="space-y-2">
          <p className="text-sm text-muted-foreground">Analizando tu costo y tus cotizaciones parecidas…</p>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {phase.name === "error" && (
        <div role="alert" className="flex flex-col gap-2 rounded-md bg-destructive/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{phase.message}</p>
          <Button type="button" size="sm" variant="outline" className="gap-1.5 self-start" onClick={() => void ask()}>
            <RotateCcw className="h-3.5 w-3.5" /> Reintentar
          </Button>
        </div>
      )}

      {phase.name === "done" && results && (
        <Result
          response={phase.response}
          results={results}
          stale={stale}
          applied={applied}
          loading={loading}
          onApply={(tier, price) => { setApplied(tier); onApplyPrice(price) }}
          onAskAgain={() => void ask()}
        />
      )}
    </section>
  )
}

function StrategyPicker({ value, onChange, disabled }: { value: Strategy; onChange: (s: Strategy) => void; disabled: boolean }) {
  return (
    <div className="space-y-1.5">
      <p id="strategy-label" className="text-sm font-medium">Qué priorizás</p>
      <div role="radiogroup" aria-labelledby="strategy-label" className="flex flex-wrap gap-2">
        {STRATEGIES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
              value === s ? "border-primary bg-primary/15 font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {STRATEGY_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

function Result({ response, results, stale, applied, loading, onApply, onAskAgain }: {
  response: PricingResponse
  results: CalculationResults
  stale: boolean
  applied: Tier | null
  loading: boolean
  onApply: (tier: Tier, pricePerUnit: number) => void
  onAskAgain: () => void
}) {
  const cost = results.costPerUnit
  const current = results.sellingPricePerUnit

  return (
    <div className="space-y-5">
      {stale && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-yellow-500/10 p-3 text-sm">
          Cambiaste datos de la pieza desde esta sugerencia.
          <button type="button" className="underline underline-offset-2" onClick={onAskAgain}>Pedir de nuevo</button>
        </p>
      )}

      <PriceLadder cost={cost} minimo={response.minimo} recomendado={response.recomendado} premium={response.premium} current={current} />

      <ul className="grid gap-2 sm:grid-cols-3">
        {TIERS.map(({ key, label, hint }) => {
          const price = response[key]
          const { margin, vsCurrent } = tierMetrics(price, cost, current)
          const isRecommended = key === "recomendado"
          return (
            <li key={key} className={cn("flex flex-col justify-between gap-3 rounded-md border p-3", isRecommended && "border-primary/50 bg-primary/5")}>
              <div>
                <p className="text-xs text-muted-foreground" title={hint}>{label} · por unidad</p>
                <p className="text-xl font-bold tabular-nums">{formatCurrencyWhole(price)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">margen {formatPercent(margin)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {Math.abs(vsCurrent) < 0.5 ? "igual a tu precio" : `${vsCurrent > 0 ? "+" : "−"}${formatPercent(Math.abs(vsCurrent))} vs tu precio`}
                </p>
                {results.quantity > 1 && <p className="text-xs text-muted-foreground tabular-nums">× {results.quantity} = {formatCurrencyWhole(price * results.quantity)}</p>}
              </div>
              <Button type="button" size="sm" variant={isRecommended ? "default" : "outline"} className="gap-1.5" onClick={() => onApply(key, price)}>
                {applied === key ? <><Check className="h-3.5 w-3.5" /> Aplicado</> : isRecommended ? "Usar este precio" : "Usar"}
              </Button>
            </li>
          )
        })}
      </ul>

      {response.alerta && (
        <p role="note" className="flex items-start gap-2 rounded-md bg-yellow-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" aria-hidden /> {response.alerta}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Por qué</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
          {response.razones.map((reason, i) => <li key={i}>{reason}</li>)}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          {response.similarCount > 0
            ? `Se basó en tu costo y en ${response.similarCount} cotización${response.similarCount === 1 ? "" : "es"} parecida${response.similarCount === 1 ? "" : "s"} ya cerrada${response.similarCount === 1 ? "" : "s"}.`
            : "No encontró cotizaciones parecidas cerradas: se basó solo en tu costo y en el mercado."}
        </p>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5" disabled={loading} onClick={onAskAgain}>
          <RotateCcw className="h-3.5 w-3.5" /> Pedir de nuevo
        </Button>
      </div>
    </div>
  )
}
