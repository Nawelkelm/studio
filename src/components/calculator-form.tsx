"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type jsPDF from 'jspdf'
import { BarChart3, Calculator, FileText } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const calculatorSchema = z.object({
  filamentCostPerKg: z.coerce.number().min(0).default(15000),
  materialUsed: z.string().min(1, "Requerido").default("PLA"),
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
  totalCostWithSupplies: number;
  sellingPrice: number;
  mercadoLibrePrice: number;
};

const MERCADOLIBRE_FEE_MULTIPLIER = 1.16;
const LOCAL_STORAGE_KEY = "3d-calculator-form-data";

export default function CalculatorForm() {
    const [results, setResults] = useState<CalculationResults | null>(null);
    const [clientName, setClientName] = useState("");

    const form = useForm<CalculatorFormValues>({
        resolver: zodResolver(calculatorSchema),
        defaultValues: calculatorSchema.parse({}), // Initialize with default schema values
    });

    // Load from localStorage on client side
    useEffect(() => {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                form.reset(parsedData);
            } catch (error) {
                console.error("Error al cargar los datos desde localStorage", error);
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }
    }, [form]);
    
    // Save to localStorage on change
    useEffect(() => {
        const subscription = form.watch((value) => {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(value));
        });
        return () => subscription.unsubscribe();
    }, [form]);
    
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
            totalCostWithSupplies,
            sellingPrice,
            mercadoLibrePrice,
        });
    };
    
    const handleExportToPdf = async () => {
        if (!results || !form.getValues() || !clientName.trim()) return;

        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');

        const doc = new jsPDF();
        const formValues = form.getValues();

        // Header
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("COTIZACIÓN", 14, 22);
        
        doc.setFontSize(12);
        doc.text("Mi Emprendimiento 3D", 140, 22);
        doc.setFontSize(10);
        doc.text("CUIT: XX-XXXXXXXX-X", 140, 28);
        doc.text("Dirección: Calle Falsa 123", 140, 33);
        
        doc.line(14, 40, 196, 40);

        // Client and Date info
        doc.setFontSize(12);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 140, 50);
        doc.text(`Cliente: ${clientName}`, 14, 50);
        
        // Robustly parse time values for display
        const printHours = parseFloat(String(formValues.printTimeHours || "0"));
        const printMinutes = parseFloat(String(formValues.printTimeMinutes || "0"));
        const timeDetail = `${printHours} hs y ${printMinutes} min`;
        const materialDetail = `${formValues.printWeightGrams}g en ${formValues.materialUsed}`;
        
        // Table
        const tableData = [
            ['Servicio de Impresión 3D', `Tiempo: ${timeDetail} | Material: ${materialDetail}`, formatCurrency(results.sellingPrice)]
        ];

        doc.autoTable({
            startY: 60,
            head: [['Descripción', 'Detalle', 'Precio']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [88, 28, 135] }, // Violet color
        });

        const finalY = (doc as any).lastAutoTable.finalY || 100;

        // Totals
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL:", 140, finalY + 25, { align: 'right' });
        doc.text(formatCurrency(results.sellingPrice), 196, finalY + 25, { align: 'right' });
        
        // Footer
        const pageHeight = doc.internal.pageSize.height;
        doc.line(14, pageHeight - 20, 196, pageHeight - 20);
        doc.setFontSize(8);
        doc.text("Documento no válido como comprobante fiscal. Válido por 7 días.", 105, pageHeight - 15, { align: 'center' });
        
        doc.save(`Cotizacion-${clientName.replace(/\s/g, '_') || 'Cliente'}.pdf`);
    };

    return (
        <div className="w-full max-w-7xl mx-auto">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-primary">Gastos Fijos</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <FormField control={form.control} name="filamentCostPerKg" render={({ field }) => ( <FormItem><FormLabel>Costo Filamento (kg)</FormLabel><FormControl><Input type="number" step="any" placeholder="ARS $" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                      <FormField control={form.control} name="materialUsed" render={({ field }) => ( <FormItem><FormLabel>Tipo de Material</FormLabel><FormControl><Input placeholder="Ej: PLA, PETG" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <FormField control={form.control} name="electricityCostKwh" render={({ field }) => ( <FormItem><FormLabel>Costo Electricidad (Kwh)</FormLabel><FormControl><Input type="number" step="any" placeholder="ARS $" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="printerPower" render={({ field }) => ( <FormItem><FormLabel>Consumo Impresora (Watts)</FormLabel><FormControl><Input type="number" step="any" placeholder="Watts" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="printerLifespan" render={({ field }) => ( <FormItem><FormLabel>Vida Útil Impresora (horas)</FormLabel><FormControl><Input type="number" step="any" placeholder="Horas" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="printerCost" render={({ field }) => ( <FormItem><FormLabel>Costo Amortización</FormLabel><FormControl><Input type="number" step="any" placeholder="ARS $" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="failureRatePercent" render={({ field }) => ( <FormItem><FormLabel>Tasa de Fallos (%)</FormLabel><FormControl><Input type="number" step="any" placeholder="%" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-primary">Costos de Pieza</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <FormLabel>Tiempo de impresión</FormLabel>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="printTimeHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Horas</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="printTimeMinutes" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Minutos</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <FormField control={form.control} name="printWeightGrams" render={({ field }) => ( <FormItem><FormLabel>Peso de la Pieza (gramos)</FormLabel><FormControl><Input type="number" step="any" placeholder="Gramos" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="extraCosts" render={({ field }) => ( <FormItem><FormLabel>Costos Adicionales</FormLabel><FormControl><Input type="number" step="any" placeholder="ARS $" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-primary">Ganancia</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="profitMultiplier"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Multiplicador de Ganancia</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="any" {...field} />
                                                </FormControl>
                                                <div className="text-xs text-muted-foreground space-y-1 pt-2">
                                                  <p className="font-bold">Referencias:</p>
                                                  <p>Precio Minorista → 4</p>
                                                  <p>Precio Mayorista → 3</p>
                                                  <p>Precio Llaveros → 5</p>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
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
                                           <BarChart3 className="w-6 h-6 text-primary" />
                                           <CardTitle>Resultados del Cálculo</CardTitle>
                                       </div>
                                       <CardDescription>Desglose de costos y precio de venta sugerido.</CardDescription>
                                   </CardHeader>
                                   <CardContent className="space-y-2">
                                       <ResultRow label="Costo de Material" value={results.materialCost}/>
                                       <ResultRow label="Costo de Electricidad" value={results.electricityCost}/>
                                       <ResultRow label="Amortización de Máquina" value={results.depreciationCost}/>
                                       <ResultRow label="Margen de Error" value={results.errorMarginCost}/>
                                       <ResultRow label="Costos Adicionales" value={results.suppliesCost}/>
                                       <Separator className="my-3 bg-border/50"/>
                                       <ResultRow label="Costo de Producción Total" value={results.totalCostWithSupplies} isBold={true} />
                                       <Separator className="my-3 bg-border/50"/>
                                       <ResultRow label="Precio de Venta" value={results.sellingPrice} className="text-2xl text-primary" isBold={true}/>
                                       <ResultRow label="Precio para MercadoLibre" value={results.mercadoLibrePrice} className="text-xl text-yellow-400" isBold={true}/>
                                   </CardContent>
                                   <CardFooter className="flex-col items-stretch gap-4 pt-4 border-t border-border/50">
                                      <Input
                                          id="clientName"
                                          value={clientName}
                                          onChange={(e) => setClientName(e.target.value)}
                                          placeholder="Nombre del cliente para la cotización"
                                      />
                                      <Button
                                          onClick={handleExportToPdf}
                                          disabled={!results || !clientName.trim()}
                                      >
                                          <FileText className="mr-2 h-5 w-5" /> Exportar a Cotización (PDF)
                                      </Button>
                                  </CardFooter>
                               </Card>
                           ) : (
                            <Card className="shadow-lg flex items-center justify-center h-full min-h-[300px] bg-card/50 border-dashed">
                                <div className="text-center text-muted-foreground p-4">
                                    <Calculator className="mx-auto h-12 w-12 mb-4" />
                                    <p className="font-semibold text-lg">Esperando cálculo...</p>
                                    <p>Completa los datos y haz clic en 'Calcular' para ver los resultados aquí.</p>
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(value || 0);
};

const ResultRow = ({ label, value, isBold = false, className = "" }: { label: string, value: number, isBold?: boolean, className?: string }) => (
    <div className={cn("flex justify-between items-baseline", isBold ? "font-bold" : "", className)}>
        <p className={cn("text-sm", isBold ? "" : "text-muted-foreground")}>{label}</p>
        <p className="font-mono tracking-tight">{formatCurrency(value)}</p>
    </div>
);

    

    