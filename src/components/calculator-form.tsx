"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { BarChart3, Calculator } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const calculatorSchema = z.object({
  filamentCostPerKg: z.coerce.number().min(0).default(15000),
  electricityCostKwh: z.coerce.number().min(0).default(140),
  printerPower: z.coerce.number().min(1).default(120),
  printerLifespan: z.coerce.number().min(1).default(4320),
  printerCost: z.coerce.number().min(0).default(150000),
  failureRatePercent: z.coerce.number().min(0).max(100).default(30),
  printTimeHours: z.coerce.number().min(0).default(0),
  printTimeMinutes: z.coerce.number().min(0).max(59).default(0),
  printWeightGrams: z.coerce.number().min(0).default(95),
  extraCosts: z.coerce.number().min(0).default(0),
  profitMultiplier: z.coerce.number().min(1).default(5),
});

type CalculatorFormValues = z.infer<typeof calculatorSchema>;

type CalculationResults = {
  materialCost: number;
  electricityCost: number;
  depreciationCost: number;
  errorMarginCost: number;
  suppliesCost: number;
  lightAndMaterialCost: number;
  totalCostWithSupplies: number;
  sellingPrice: number;
  mercadoLibrePrice: number;
};

const MERCADOLIBRE_FEE_MULTIPLIER = 1.16;

export default function CalculatorForm() {
    const [results, setResults] = useState<CalculationResults | null>(null);
    const [currency, setCurrency] = useState("ARS");

    const form = useForm<CalculatorFormValues>({
        resolver: zodResolver(calculatorSchema),
        defaultValues: calculatorSchema.parse({}),
    });
    
    const onSubmit = (values: CalculatorFormValues) => {
        const {
            filamentCostPerKg, electricityCostKwh, printerPower, printerLifespan,
            printerCost, failureRatePercent, printTimeHours, printTimeMinutes,
            printWeightGrams, extraCosts, profitMultiplier,
        } = values;
        
        const totalPrintTimeHours = printTimeHours + (printTimeMinutes / 60);

        const materialCost = (filamentCostPerKg / 1000) * printWeightGrams;
        const electricityCost = (printerPower / 1000) * totalPrintTimeHours * electricityCostKwh;
        const depreciationCost = printerLifespan > 0 ? (printerCost / printerLifespan) * totalPrintTimeHours : 0;
        
        const baseCost = materialCost + electricityCost + depreciationCost;
        const errorMarginCost = baseCost * (failureRatePercent / 100);
        const suppliesCost = extraCosts;
        
        const totalCostWithSupplies = baseCost + errorMarginCost + suppliesCost;
        const sellingPrice = totalCostWithSupplies * profitMultiplier;
        const mercadoLibrePrice = sellingPrice * MERCADOLIBRE_FEE_MULTIPLIER;

        setResults({
            materialCost,
            electricityCost,
            depreciationCost,
            errorMarginCost,
            suppliesCost,
            lightAndMaterialCost: baseCost,
            totalCostWithSupplies,
            sellingPrice,
            mercadoLibrePrice,
        });
    };
    
    const CurrencyButton = ({ value, label, current, onClick, disabled = false }: { value: string, label: string, current: string, onClick: (value: string) => void, disabled?: boolean }) => (
      <Button
        type="button"
        variant={current === value ? 'default' : 'outline'}
        onClick={() => onClick(value)}
        disabled={disabled}
      >
        {label}
      </Button>
    );

    return (
        <div className="w-full max-w-7xl mx-auto">
             <div className="flex justify-center mb-6 gap-2">
                <CurrencyButton value="ARS" label="ARS $" current={currency} onClick={setCurrency} />
                <CurrencyButton value="USD" label="USD US$" current={currency} onClick={setCurrency} disabled />
                <CurrencyButton value="EUR" label="EUR €" current={currency} onClick={setCurrency} disabled />
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-accent">Gastos Fijos</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField control={form.control} name="filamentCostPerKg" render={({ field }) => ( <FormItem><FormLabel>Precio KG (ARS $)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="electricityCostKwh" render={({ field }) => ( <FormItem><FormLabel>Precio Kwh (ARS $)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="printerPower" render={({ field }) => ( <FormItem><FormLabel>Consumo real por hora (W)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="printerLifespan" render={({ field }) => ( <FormItem><FormLabel>Desgaste máquina (horas)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="printerCost" render={({ field }) => ( <FormItem><FormLabel>Precio Repuestos (ARS $)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="failureRatePercent" render={({ field }) => ( <FormItem><FormLabel>% Margen de Error</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-accent">Pieza</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <FormLabel>Tiempo de impresión</FormLabel>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="printTimeHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Horas</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="printTimeMinutes" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Minutos</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <FormField control={form.control} name="printWeightGrams" render={({ field }) => ( <FormItem><FormLabel>Gramos de filamento</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="extraCosts" render={({ field }) => ( <FormItem><FormLabel>INSUMOS (ARS $)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-accent">Ganancia</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField control={form.control} name="profitMultiplier" render={({ field }) => ( <FormItem><FormLabel>Margen de ganancia (multiplicador)</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <div>
                                        <FormLabel>Referencias:</FormLabel>
                                        <p className="text-sm text-muted-foreground mt-2"> Precio Minorista → 4<br/> Precio Mayorista → 3<br/> Precio Llaveros → 5 </p>
                                    </div>
                                </CardContent>
                            </Card>
                             <div className="flex justify-center pt-4">
                                <Button type="submit" size="lg" className="w-full md:w-auto">
                                    <Calculator className="mr-2 h-5 w-5" /> Calcular
                                </Button>
                            </div>
                        </div>

                        <div className="lg:sticky top-8">
                           {results ? (
                               <Card className="shadow-lg">
                                   <CardHeader>
                                       <div className="flex items-center gap-3">
                                           <BarChart3 className="w-6 h-6 text-accent" />
                                           <CardTitle>Resultados</CardTitle>
                                       </div>
                                       <CardDescription>Desglose de costos y precio de venta.</CardDescription>
                                   </CardHeader>
                                   <CardContent className="space-y-2">
                                       <ResultRow label="Precio Material" value={results.materialCost} currency={currency}/>
                                       <ResultRow label="Precio Luz" value={results.electricityCost} currency={currency}/>
                                       <ResultRow label="Desgaste Máquina" value={results.depreciationCost} currency={currency}/>
                                       <ResultRow label="Margen de Error" value={results.errorMarginCost} currency={currency}/>
                                       <ResultRow label="INSUMOS" value={results.suppliesCost} currency={currency}/>
                                       <Separator className="my-3 bg-border/50"/>
                                       <ResultRow label="Costo Luz y Material" value={results.lightAndMaterialCost} currency={currency}/>
                                       <ResultRow label="Costo Total (incluye insumos)" value={results.totalCostWithSupplies} currency={currency}/>
                                       <Separator className="my-3 bg-border/50"/>
                                       <ResultRow label="TOTAL A COBRAR" value={results.sellingPrice} currency={currency} className="text-2xl text-primary" isBold={true}/>
                                       <ResultRow label="PRECIO MERCADOLIBRE" value={results.mercadoLibrePrice} currency={currency} className="text-2xl text-yellow-400" isBold={true}/>
                                   </CardContent>
                               </Card>
                           ) : (
                            <Card className="shadow-lg flex items-center justify-center h-full min-h-[300px] bg-card/50 border-dashed">
                                <div className="text-center text-muted-foreground p-4">
                                    <p>Completa los datos y haz clic en 'Calcular'</p>
                                    <p>para ver los resultados aquí.</p>
                                </div>
                            </Card>
                           )}
                        </div>
                    </div>
                </form>
            </Form>
        </div>
    );
}

const formatCurrency = (value: number, currency: string) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

const ResultRow = ({ label, value, currency, isBold = false, className = "" }: { label: string, value: number, currency: string, isBold?: boolean, className?: string }) => (
    <div className={cn("flex justify-between items-baseline", isBold ? "font-bold" : "", className)}>
        <p className={cn("text-sm", isBold ? "" : "text-muted-foreground")}>{label}</p>
        <p className="font-mono tracking-tight">{formatCurrency(value, currency)}</p>
    </div>
);
