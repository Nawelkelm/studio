"use client"

import { useEffect, useState } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, Bot } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import type { CalculationSnapshot } from "@/lib/calculator"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const aiPricingSchema = z.object({
  productDescription: z.string().min(10, "Por favor, proporciona una descripción más detallada.").max(500),
  materialUsed: z.string().min(2, "El material es requerido.").max(50),
  printingTime: z.coerce.number().min(0.1, "El tiempo de impresión debe ser de al menos 0.1 horas."),
})

type AiPricingFormValues = z.infer<typeof aiPricingSchema>

type SuggestPricingResult = {
  suggestedPrice: string;
  reasoning: string;
};

const formatArs = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)

export default function AiPricingAssistant({ calculation }: { calculation: CalculationSnapshot | null }) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SuggestPricingResult | null>(null)
  const [useCalculation, setUseCalculation] = useState(true)
  const { toast } = useToast()

  const form = useForm<AiPricingFormValues>({
    resolver: zodResolver(aiPricingSchema),
    defaultValues: {
      productDescription: "",
      materialUsed: "PLA",
      printingTime: 1,
    },
  })

  // Prefill material and print time from the latest calculation
  useEffect(() => {
    if (!calculation) return
    const hours = calculation.printTimeHours + calculation.printTimeMinutes / 60
    form.setValue("materialUsed", calculation.materialUsed)
    form.setValue("printingTime", Math.max(0.1, Math.round(hours * 10) / 10))
  }, [calculation, form])

  const onSubmit: SubmitHandler<AiPricingFormValues> = async (data) => {
    setIsLoading(true)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/suggest-pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          ...data,
          printingTime: `${data.printingTime} horas`,
          ...(useCalculation && calculation && {
            costContext: {
              costPerUnit: calculation.costPerUnit,
              sellingPricePerUnit: calculation.sellingPricePerUnit,
              profitMultiplier: calculation.profitMultiplier,
            },
          }),
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errorData.error || `Error del servidor (${res.status})`)
      }
      const response = await res.json()
      setResult(response)
    } catch (error) {
      console.error("AI Pricing Assistant Error:", error)
      const msg = error instanceof Error ? error.message : "Error desconocido"
      toast({
        variant: "destructive",
        title: "Error",
        description: msg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Asistente de Precios IA</CardTitle>
        <CardDescription>
          Obtén una sugerencia de precio con IA basada en los detalles de tu producto.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {calculation ? (
              <div className="rounded-lg border border-primary/30 bg-secondary/40 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="use-calculation"
                    checked={useCalculation}
                    onCheckedChange={(checked) => setUseCalculation(checked === true)}
                  />
                  <Label htmlFor="use-calculation" className="text-sm font-medium cursor-pointer">
                    Usar mi último cálculo como base
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Costo de producción {formatArs(calculation.costPerUnit)} por unidad · precio con tu multiplicador x{calculation.profitMultiplier}: {formatArs(calculation.sellingPricePerUnit)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
                Tip: calculá primero una pieza en la calculadora y la IA va a usar tu costo real para sugerir el precio.
              </p>
            )}
            <FormField
              control={form.control}
              name="productDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del Producto</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ej: Una miniatura detallada de un castillo de fantasía" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="materialUsed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material Usado</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: PLA, ABS, PETG" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="printingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiempo de Impresión (horas)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="bg-accent hover:bg-accent/90">
              <Sparkles className="mr-2 h-4 w-4" />
              {isLoading ? "Obteniendo Sugerencia..." : "Obtener Sugerencia"}
            </Button>
          </CardFooter>
        </form>
      </Form>
      
      {(isLoading || result) && (
        <CardContent>
          {isLoading && <SuggestionSkeleton />}
          {result && !isLoading && (
            <Card className="bg-secondary/50 border-accent">
              <CardHeader className="flex flex-row items-start gap-4">
                <Bot className="h-8 w-8 text-accent shrink-0 mt-1"/>
                <div>
                  <CardTitle>Sugerencia de la IA</CardTitle>
                  <CardDescription>
                    Basado en la información proporcionada, aquí tienes una sugerencia de precio.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Precio Sugerido</p>
                  <p className="text-3xl font-bold text-accent">{result.suggestedPrice}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Razonamiento</p>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{result.reasoning}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function SuggestionSkeleton() {
  return (
    <Card className="bg-secondary/50">
      <CardHeader className="flex flex-row items-start gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </div>
      </CardContent>
    </Card>
  )
}
