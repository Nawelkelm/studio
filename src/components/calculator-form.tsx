"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type jsPDF from 'jspdf'
import { BarChart3, Calculator, FileText, RotateCcw, Settings, PieChart as PieChartIcon, Package, Printer, Save, Loader2 } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts"

import { cn } from "@/lib/utils"
import { supabase, type Printer as PrinterType } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

declare module 'jspdf' {
  interface jsPDF { autoTable: (options: any) => jsPDF; }
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
  profitMultiplier: z.coerce.number().min(1).max(10).default(5),
  quantity: z.coerce.number().min(1).default(1),
});
type CalculatorFormValues = z.infer<typeof calculatorSchema>;

type CalculationResults = {
  materialCost: number; electricityCost: number; depreciationCost: number;
  errorMarginCost: number; suppliesCost: number; totalCostWithSupplies: number;
  sellingPrice: number; mercadoLibrePrice: number; profitAmount: number;
  costPerUnit: number; sellingPricePerUnit: number; quantity: number;
};

type BusinessInfo = { businessName: string; cuit: string; address: string; phone: string; };

const MERCADOLIBRE_FEE_MULTIPLIER = 1.16;
const BUSINESS_INFO_KEY = "3d-calculator-business-info";
const CHART_COLORS = ["hsl(252,78%,65%)","hsl(240,60%,50%)","hsl(268,80%,58%)","hsl(278,65%,62%)","hsl(200,70%,55%)"];
const DEFAULT_BUSINESS_INFO: BusinessInfo = { businessName: "Doji Print - Impresiones 3D", cuit: "", address: "", phone: "" };

function getStorageKey(printerId: string | null) {
  return printerId ? `3d-calc-${printerId}` : "3d-calc-default";
}

export default function CalculatorForm() {
    const { user } = useAuth();
    const [results, setResults] = useState<CalculationResults | null>(null);
    const [clientName, setClientName] = useState("");
    const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [printers, setPrinters] = useState<PrinterType[]>([]);
    const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
    const [savingQuotation, setSavingQuotation] = useState(false);
    const { toast } = useToast();

    const form = useForm<CalculatorFormValues>({
        resolver: zodResolver(calculatorSchema),
        defaultValues: calculatorSchema.parse({}),
    });

    // Load printers from Supabase
    useEffect(() => {
        supabase.from("printers").select("*").order("name").then(({ data }) => {
            if (data) {
                setPrinters(data);
                const saved = localStorage.getItem("3d-calc-printer");
                if (saved && data.find(p => p.id === saved)) setSelectedPrinterId(saved);
                else if (data.length > 0) setSelectedPrinterId(data[0].id);
            }
        });
    }, []);

    // Load form data when printer changes
    useEffect(() => {
        const key = getStorageKey(selectedPrinterId);
        const savedData = localStorage.getItem(key);
        if (savedData) {
            try { form.reset(JSON.parse(savedData)); } catch { localStorage.removeItem(key); }
        } else if (selectedPrinterId) {
            const printer = printers.find(p => p.id === selectedPrinterId);
            if (printer) {
                form.reset({
                    ...calculatorSchema.parse({}),
                    filamentCostPerKg: printer.filament_cost_per_kg,
                    electricityCostKwh: printer.electricity_cost_kwh,
                    printerPower: printer.printer_power,
                    printerLifespan: printer.printer_lifespan,
                    printerCost: printer.printer_cost,
                    failureRatePercent: printer.failure_rate_percent,
                });
            }
        }
        setResults(null);
    }, [selectedPrinterId, printers, form]);

    // Persist form per printer
    useEffect(() => {
        const sub = form.watch((v) => localStorage.setItem(getStorageKey(selectedPrinterId), JSON.stringify(v)));
        return () => sub.unsubscribe();
    }, [form, selectedPrinterId]);

    // Load business info
    useEffect(() => {
        const s = localStorage.getItem(BUSINESS_INFO_KEY);
        if (s) try { setBusinessInfo(JSON.parse(s)); } catch { /**/ }
    }, []);

    const handlePrinterChange = (id: string) => {
        setSelectedPrinterId(id);
        localStorage.setItem("3d-calc-printer", id);
    };

    const selectedPrinter = printers.find(p => p.id === selectedPrinterId);

    const handleSaveBusinessInfo = (info: BusinessInfo) => {
        setBusinessInfo(info);
        localStorage.setItem(BUSINESS_INFO_KEY, JSON.stringify(info));
        setSettingsOpen(false);
        toast({ title: "Datos guardados" });
    };

    const handleReset = () => {
        const printer = printers.find(p => p.id === selectedPrinterId);
        if (printer) {
            form.reset({ ...calculatorSchema.parse({}), filamentCostPerKg: printer.filament_cost_per_kg, electricityCostKwh: printer.electricity_cost_kwh, printerPower: printer.printer_power, printerLifespan: printer.printer_lifespan, printerCost: printer.printer_cost, failureRatePercent: printer.failure_rate_percent });
        } else { form.reset(calculatorSchema.parse({})); }
        setResults(null);
        localStorage.removeItem(getStorageKey(selectedPrinterId));
        toast({ title: "Formulario reseteado" });
    };

    const onSubmit = (values: CalculatorFormValues) => {
        const { filamentCostPerKg, electricityCostKwh, printerPower, printerLifespan, printerCost, failureRatePercent, printTimeHours, printTimeMinutes, printWeightGrams, extraCosts, profitMultiplier, quantity } = values;
        const totalPrintTimeHours = printTimeHours + (printTimeMinutes / 60);
        const materialCostUnit = (filamentCostPerKg / 1000) * printWeightGrams;
        const electricityCostUnit = (printerPower / 1000) * totalPrintTimeHours * electricityCostKwh;
        const depreciationCostUnit = printerLifespan > 0 ? (printerCost / printerLifespan) * totalPrintTimeHours : 0;
        const baseCostUnit = materialCostUnit + electricityCostUnit + depreciationCostUnit;
        const errorMarginCostUnit = baseCostUnit * (failureRatePercent / 100);
        const totalCostUnit = baseCostUnit + errorMarginCostUnit + extraCosts;
        const sellingPriceUnit = totalCostUnit * profitMultiplier;
        const totalCostWithSupplies = totalCostUnit * quantity;
        const sellingPrice = sellingPriceUnit * quantity;
        setResults({
            materialCost: materialCostUnit * quantity, electricityCost: electricityCostUnit * quantity,
            depreciationCost: depreciationCostUnit * quantity, errorMarginCost: errorMarginCostUnit * quantity,
            suppliesCost: extraCosts * quantity, totalCostWithSupplies, sellingPrice,
            mercadoLibrePrice: sellingPrice * MERCADOLIBRE_FEE_MULTIPLIER,
            profitAmount: sellingPrice - totalCostWithSupplies,
            costPerUnit: totalCostUnit, sellingPricePerUnit: sellingPriceUnit, quantity,
        });
    };

    const chartData = useMemo(() => {
        if (!results) return [];
        return [
            { name: "Material", value: results.materialCost }, { name: "Electricidad", value: results.electricityCost },
            { name: "Amortización", value: results.depreciationCost }, { name: "Margen Error", value: results.errorMarginCost },
            { name: "Adicionales", value: results.suppliesCost },
        ].filter(i => i.value > 0);
    }, [results]);

    const saveQuotationToDb = useCallback(async () => {
        if (!results || !clientName.trim() || !user) return false;
        setSavingQuotation(true);
        const v = form.getValues();
        const { error } = await supabase.from("quotations").insert({
            user_id: user.id,
            user_name: user.user_metadata?.full_name || user.email || "Desconocido",
            user_email: user.email,
            client_name: clientName.trim(),
            printer_id: selectedPrinterId,
            printer_name: selectedPrinter?.name || "Sin impresora",
            material_used: v.materialUsed, print_weight_grams: v.printWeightGrams,
            print_time_hours: v.printTimeHours, print_time_minutes: v.printTimeMinutes,
            quantity: v.quantity, extra_costs: v.extraCosts, profit_multiplier: v.profitMultiplier,
            total_cost: results.totalCostWithSupplies, selling_price: results.sellingPrice, status: "pendiente",
        });
        setSavingQuotation(false);
        if (error) { toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la cotización." }); return false; }
        toast({ title: "Cotización guardada", description: "Se registró en el historial." });
        return true;
    }, [results, clientName, user, form, selectedPrinterId, selectedPrinter, toast]);

    const handleExportToPdf = async () => {
        if (!results || !clientName.trim()) return;
        await saveQuotationToDb();
        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const doc = new jsPDF();
        const fv = form.getValues();

        try {
          const logoRes = await fetch('/logo.png');
          const logoBlob = await logoRes.blob();
          const logoBase64 = await new Promise<string>((r) => { const reader = new FileReader(); reader.onloadend = () => r(reader.result as string); reader.readAsDataURL(logoBlob); });
          doc.addImage(logoBase64, 'PNG', 14, 8, 28, 28);
        } catch { /**/ }

        doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("COTIZACIÓN", 48, 22);
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 80, 160); doc.text("Doji Print - Impresiones 3D", 48, 30); doc.setTextColor(0, 0, 0);
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text(businessInfo.businessName, 140, 18);
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        let infoY = 24;
        if (businessInfo.cuit) { doc.text(`CUIT: ${businessInfo.cuit}`, 140, infoY); infoY += 5; }
        if (businessInfo.address) { doc.text(businessInfo.address, 140, infoY); infoY += 5; }
        if (businessInfo.phone) { doc.text(`Tel: ${businessInfo.phone}`, 140, infoY); }
        doc.line(14, 42, 196, 42);
        doc.setFontSize(12); doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 140, 52); doc.text(`Cliente: ${clientName}`, 14, 52);
        let startY = 60;
        if (selectedPrinter) { doc.setFontSize(9); doc.text(`Impresora: ${selectedPrinter.name}`, 14, 58); startY = 64; }

        const ph = parseFloat(String(fv.printTimeHours || "0")); const pm = parseFloat(String(fv.printTimeMinutes || "0"));
        const tableData: string[][] = [
            ['Costo de Material', `${fv.printWeightGrams}g en ${fv.materialUsed}`, formatCurrency(results.materialCost)],
            ['Costo de Electricidad', `${fv.printerPower}W x ${ph} hs y ${pm} min`, formatCurrency(results.electricityCost)],
            ['Amortización', `Vida útil: ${fv.printerLifespan} hs`, formatCurrency(results.depreciationCost)],
            ['Margen de Error', `${fv.failureRatePercent}%`, formatCurrency(results.errorMarginCost)],
        ];
        if (results.suppliesCost > 0) tableData.push(['Costos Adicionales', '', formatCurrency(results.suppliesCost)]);
        if (results.quantity > 1) tableData.push(['Cantidad', `${results.quantity} unidades`, '']);

        doc.autoTable({ startY, head: [['Concepto', 'Detalle', 'Monto']], body: tableData, theme: 'striped', headStyles: { fillColor: [30, 16, 84] } });
        const finalY = (doc as any).lastAutoTable.finalY || 100;
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Costo de Producción: ${formatCurrency(results.totalCostWithSupplies)}`, 196, finalY + 15, { align: 'right' });
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("TOTAL:", 140, finalY + 30, { align: 'right' }); doc.text(formatCurrency(results.sellingPrice), 196, finalY + 30, { align: 'right' });
        if (results.quantity > 1) { doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`(${formatCurrency(results.sellingPricePerUnit)} por unidad)`, 196, finalY + 38, { align: 'right' }); }
        const pageH = doc.internal.pageSize.height;
        doc.line(14, pageH - 20, 196, pageH - 20); doc.setFontSize(8); doc.text("Documento no válido como comprobante fiscal. Válido por 7 días.", 105, pageH - 15, { align: 'center' });
        doc.save(`Cotizacion-${clientName.replace(/\s/g, '_') || 'Cliente'}.pdf`);
    };

    const profitMultiplier = form.watch("profitMultiplier");

    return (
        <div className="w-full max-w-7xl mx-auto">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-6">
                            <Card className="border-primary/30">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-xl text-primary flex items-center gap-2"><Printer className="h-5 w-5" /> Impresora</CardTitle>
                                    <CardDescription>Seleccioná la impresora para cargar sus valores</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {printers.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {printers.map((p) => (
                                                <Button key={p.id} type="button" variant={selectedPrinterId === p.id ? "default" : "outline"} className="h-auto py-3 flex-col gap-1" onClick={() => handlePrinterChange(p.id)}>
                                                    <span className="font-bold text-sm">{p.name}</span>
                                                    <span className="text-[10px] opacity-70">{p.printer_power}W · {formatCurrency(p.printer_cost)}</span>
                                                </Button>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-muted-foreground">Cargando impresoras...</p>}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-primary">Gastos Fijos</CardTitle><CardDescription>Costos de {selectedPrinter?.name || "tu impresora"} y servicios</CardDescription></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <FormField control={form.control} name="filamentCostPerKg" render={({ field }) => ( <FormItem><FormLabel>Costo Filamento (kg)</FormLabel><FormControl><Input type="number" step="any" placeholder="ARS $" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                      <FormField control={form.control} name="materialUsed" render={({ field }) => ( <FormItem><FormLabel>Tipo de Material</FormLabel><FormControl><Input placeholder="Ej: PLA, PETG" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <FormField control={form.control} name="electricityCostKwh" render={({ field }) => ( <FormItem><FormLabel>Costo Electricidad (Kwh)</FormLabel><FormControl><Input type="number" step="any" placeholder="ARS $" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="printerPower" render={({ field }) => ( <FormItem><FormLabel>Consumo (Watts)</FormLabel><FormControl><Input type="number" step="any" placeholder="Watts" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="printerLifespan" render={({ field }) => ( <FormItem><FormLabel>Vida Útil (horas)</FormLabel><FormControl><Input type="number" step="any" placeholder="Horas" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="printerCost" render={({ field }) => ( <FormItem><FormLabel>Costo Impresora</FormLabel><FormControl><Input type="number" step="any" placeholder="ARS $" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="failureRatePercent" render={({ field }) => ( <FormItem><FormLabel>Tasa de Fallos (%)</FormLabel><FormControl><Input type="number" step="any" placeholder="%" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-primary">Costos de Pieza</CardTitle><CardDescription>Datos específicos de esta impresión</CardDescription></CardHeader>
                                <CardContent className="space-y-4">
                                    <FormLabel>Tiempo de impresión</FormLabel>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="printTimeHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Horas</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="printTimeMinutes" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Minutos</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="printWeightGrams" render={({ field }) => ( <FormItem><FormLabel>Peso de la Pieza (gramos)</FormLabel><FormControl><Input type="number" step="any" placeholder="Gramos" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="quantity" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Cantidad</FormLabel><FormControl><Input type="number" min={1} step={1} placeholder="1" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <FormField control={form.control} name="extraCosts" render={({ field }) => ( <FormItem><FormLabel>Costos Adicionales (pintura, pegamento, etc.)</FormLabel><FormControl><Input type="number" step="any" placeholder="ARS $" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="text-xl text-primary">Ganancia</CardTitle><CardDescription>Definí tu margen de ganancia</CardDescription></CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField control={form.control} name="profitMultiplier" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Multiplicador: <span className="text-primary text-lg font-bold">x{profitMultiplier}</span></FormLabel>
                                            <FormControl><Slider min={1} max={10} step={0.5} value={[field.value]} onValueChange={(val) => field.onChange(val[0])} /></FormControl>
                                            <div className="flex justify-between text-xs text-muted-foreground pt-1"><span>x1 (sin ganancia)</span><span>x10</span></div>
                                            <div className="grid grid-cols-3 gap-2 pt-3">
                                                {[{ label: "Mayorista", value: 3 },{ label: "Minorista", value: 4 },{ label: "Premium", value: 5 }].map((preset) => (
                                                    <Button key={preset.value} type="button" variant={profitMultiplier === preset.value ? "default" : "outline"} size="sm" className="flex-col h-auto py-2" onClick={() => field.onChange(preset.value)}>
                                                        <span className="font-bold">x{preset.value}</span><span className="text-[10px] opacity-70">{preset.label}</span>
                                                    </Button>
                                                ))}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </CardContent>
                            </Card>
                            <div className="flex gap-3 justify-center pt-2">
                                <Button type="submit" size="lg" className="flex-1 md:flex-none"><Calculator className="mr-2 h-5 w-5" /> Calcular</Button>
                                <Button type="button" variant="outline" size="lg" onClick={handleReset}><RotateCcw className="mr-2 h-4 w-4" /> Resetear</Button>
                                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                                    <DialogTrigger asChild><Button type="button" variant="outline" size="lg"><Settings className="h-4 w-4" /></Button></DialogTrigger>
                                    <BusinessInfoDialog businessInfo={businessInfo} onSave={handleSaveBusinessInfo} />
                                </Dialog>
                            </div>
                        </div>

                        <div className="lg:sticky top-8 space-y-6">
                           {results ? (<>
                               <Card className="shadow-lg">
                                   <CardHeader>
                                       <div className="flex items-center gap-3"><BarChart3 className="w-6 h-6 text-primary" /><div><CardTitle>Resultados</CardTitle><CardDescription>{selectedPrinter ? `${selectedPrinter.name} · ` : ""}Desglose de costos y precio.</CardDescription></div></div>
                                   </CardHeader>
                                   <CardContent className="space-y-2">
                                       <ResultRow label="Costo de Material" value={results.materialCost}/>
                                       <ResultRow label="Costo de Electricidad" value={results.electricityCost}/>
                                       <ResultRow label="Amortización de Máquina" value={results.depreciationCost}/>
                                       <ResultRow label="Margen de Error" value={results.errorMarginCost}/>
                                       <ResultRow label="Costos Adicionales" value={results.suppliesCost}/>
                                       <Separator className="my-3 bg-border/50"/>
                                       <ResultRow label="Costo de Producción Total" value={results.totalCostWithSupplies} isBold/>
                                       <Separator className="my-3 bg-border/50"/>
                                       <ResultRow label="Precio de Venta" value={results.sellingPrice} className="text-2xl text-primary" isBold/>
                                       <ResultRow label="Ganancia Neta" value={results.profitAmount} className="text-lg text-green-400" isBold/>
                                       <ResultRow label="Precio MercadoLibre (+16%)" value={results.mercadoLibrePrice} className="text-lg text-yellow-400" isBold/>
                                       {results.quantity > 1 && (<><Separator className="my-3 bg-border/50"/><div className="bg-secondary/50 rounded-lg p-3 space-y-1"><p className="text-xs text-muted-foreground font-medium">Precio por unidad ({results.quantity} uds)</p><ResultRow label="Costo/unidad" value={results.costPerUnit}/><ResultRow label="Precio/unidad" value={results.sellingPricePerUnit} isBold className="text-primary"/></div></>)}
                                   </CardContent>
                                   <CardFooter className="flex-col items-stretch gap-4 pt-4 border-t border-border/50">
                                      <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nombre del cliente para la cotización" />
                                      <div className="flex gap-2">
                                          <Button type="button" onClick={handleExportToPdf} disabled={!results || !clientName.trim() || savingQuotation} className="flex-1">
                                              {savingQuotation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-5 w-5" />} Exportar PDF + Guardar
                                          </Button>
                                          <Button type="button" variant="outline" onClick={saveQuotationToDb} disabled={!results || !clientName.trim() || savingQuotation} title="Solo guardar sin PDF">
                                              <Save className="h-4 w-4" />
                                          </Button>
                                      </div>
                                  </CardFooter>
                               </Card>
                               {chartData.length > 0 && (
                                   <Card className="shadow-lg">
                                       <CardHeader><div className="flex items-center gap-3"><PieChartIcon className="w-5 h-5 text-primary" /><CardTitle className="text-lg">Distribución de Costos</CardTitle></div></CardHeader>
                                       <CardContent>
                                           <ResponsiveContainer width="100%" height={260}>
                                               <PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{chartData.map((_, i) => <Cell key={`c-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><RechartsTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(252,45%,13%)', border: '1px solid hsl(252,30%,22%)', borderRadius: '8px' }} itemStyle={{ color: 'hsl(0,0%,98%)' }} /><Legend /></PieChart>
                                           </ResponsiveContainer>
                                       </CardContent>
                                   </Card>
                               )}
                           </>) : (
                            <Card className="shadow-lg flex items-center justify-center h-full min-h-[300px] bg-card/50 border-dashed">
                                <div className="text-center text-muted-foreground p-4"><Calculator className="mx-auto h-12 w-12 mb-4" /><p className="font-semibold text-lg">Esperando cálculo...</p><p>Completá los datos y hacé clic en &apos;Calcular&apos;.</p></div>
                            </Card>
                           )}
                        </div>
                    </div>
                </form>
            </Form>
        </div>
    );
}

function BusinessInfoDialog({ businessInfo, onSave }: { businessInfo: BusinessInfo; onSave: (info: BusinessInfo) => void }) {
    const [info, setInfo] = useState(businessInfo);
    useEffect(() => { setInfo(businessInfo); }, [businessInfo]);
    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Datos del Negocio</DialogTitle><DialogDescription>Estos datos aparecerán en las cotizaciones PDF.</DialogDescription></DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2"><Label htmlFor="businessName">Nombre del Emprendimiento</Label><Input id="businessName" value={info.businessName} onChange={(e) => setInfo({ ...info, businessName: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="cuit">CUIT (opcional)</Label><Input id="cuit" placeholder="XX-XXXXXXXX-X" value={info.cuit} onChange={(e) => setInfo({ ...info, cuit: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="address">Dirección (opcional)</Label><Input id="address" placeholder="Tu dirección" value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="phone">Teléfono (opcional)</Label><Input id="phone" placeholder="Tu teléfono" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => onSave(info)}>Guardar</Button></DialogFooter>
        </DialogContent>
    );
}

const formatCurrency = (v: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(v || 0);

const ResultRow = ({ label, value, isBold = false, className = "" }: { label: string; value: number; isBold?: boolean; className?: string }) => (
    <div className={cn("flex justify-between items-baseline", isBold ? "font-bold" : "", className)}>
        <p className={cn("text-sm", isBold ? "" : "text-muted-foreground")}>{label}</p>
        <p className="font-mono tracking-tight">{formatCurrency(value)}</p>
    </div>
);