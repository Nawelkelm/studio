"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Printer,
  Droplets,
  Clock,
  Briefcase,
  Save,
  FolderOpen,
  Trash2,
  BarChart3,
} from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
  printerCost: z.coerce.number().min(0).default(500),
  printerLifespan: z.coerce.number().min(1).default(4000),
  printerPower: z.coerce.number().min(1).default(250),
  electricityCostKwh: z.coerce.number().min(0).default(0.15),
  filamentCost: z.coerce.number().min(1).default(25),
  filamentWeight: z.coerce.number().min(1).default(1000),
  printTimeHours: z.coerce.number().min(0).default(5),
  printWeightGrams: z.coerce.number().min(0).default(100),
  operatorHourlyRate: z.coerce.number().min(0).default(20),
  postProcessingTimeMinutes: z.coerce.number().min(0).default(15),
  failureRatePercent: z.coerce.number().min(0).max(100).default(5),
  desiredProfitMarginPercent: z.coerce.number().min(0).default(50),
});

type CalculatorFormValues = z.infer<typeof calculatorSchema>;

type CalculationResults = {
  machineDepreciationCost: number
  electricityUsageCost: number
  filamentConsumedCost: number
  operatorCost: number
  subTotalCost: number
  failureRiskCost: number
  totalCost: number
  profitAmount: number
  sellingPrice: number
};

const defaultResults: CalculationResults = {
    machineDepreciationCost: 0,
    electricityUsageCost: 0,
    filamentConsumedCost: 0,
    operatorCost: 0,
    subTotalCost: 0,
    failureRiskCost: 0,
    totalCost: 0,
    profitAmount: 0,
    sellingPrice: 0,
};

const LOCAL_STORAGE_KEY = "3d-print-profile";

export default function CalculatorForm() {
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    
    const form = useForm<CalculatorFormValues>({
        resolver: zodResolver(calculatorSchema),
        defaultValues: calculatorSchema.parse({}),
    });
    
    const { reset } = form;

    useEffect(() => {
        setIsMounted(true);
        try {
            const savedProfile = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedProfile) {
                const values = calculatorSchema.parse(JSON.parse(savedProfile));
                reset(values);
            }
        } catch (error) {
             console.error("Failed to load profile from local storage", error);
        }
    }, [reset]);

    const watchedValues = form.watch();

    const results = useMemo<CalculationResults>(() => {
        const values = watchedValues;
        const {
            printerCost, printerLifespan, printerPower, electricityCostKwh,
            filamentCost, filamentWeight, printTimeHours, printWeightGrams,
            operatorHourlyRate, postProcessingTimeMinutes, failureRatePercent, desiredProfitMarginPercent,
        } = values;

        if (printerLifespan === 0 || filamentWeight === 0) return defaultResults;

        const machineDepreciationCost = (printerCost / printerLifespan) * printTimeHours;
        const electricityUsageCost = (printerPower / 1000) * printTimeHours * electricityCostKwh;
        const filamentConsumedCost = (filamentCost / filamentWeight) * printWeightGrams;
        const totalLaborHours = printTimeHours + (postProcessingTimeMinutes / 60);
        const operatorCost = operatorHourlyRate * totalLaborHours;
        const subTotalCost = machineDepreciationCost + electricityUsageCost + filamentConsumedCost + operatorCost;
        const failureRiskCost = subTotalCost * (failureRatePercent / 100);
        const totalCost = subTotalCost + failureRiskCost;
        const profitAmount = totalCost * (desiredProfitMarginPercent / 100);
        const sellingPrice = totalCost + profitAmount;
        
        return {
            machineDepreciationCost,
            electricityUsageCost,
            filamentConsumedCost,
            operatorCost,
            subTotalCost,
            failureRiskCost,
            totalCost,
            profitAmount,
            sellingPrice
        };
    }, [watchedValues]);

    const handleSaveProfile = () => {
        try {
            const values = form.getValues();
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(values));
            toast({
                title: "Perfil Guardado",
                description: "La configuración de tu calculadora ha sido guardada.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo guardar el perfil.",
            });
        }
    };

    const handleLoadProfile = () => {
        try {
            const savedProfile = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedProfile) {
                const values = calculatorSchema.parse(JSON.parse(savedProfile));
                form.reset(values);
                toast({
                    title: "Perfil Cargado",
                    description: "Tu configuración ha sido restaurada.",
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "No se encontró perfil",
                    description: "No hay un perfil guardado para cargar.",
                });
            }
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo cargar el perfil. Podría estar corrupto.",
            });
        }
    };

    const handleReset = () => {
        form.reset(calculatorSchema.parse({}));
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        toast({
            title: "Restablecido",
            description: "La calculadora ha sido restablecida a sus valores por defecto."
        });
    }

    if (!isMounted) {
        return null;
    }

    return (
        <Form {...form}>
            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-8">
                        <InputCard icon={Printer} title="Impresora y Energía" description="Costos relacionados con tu impresora 3D y electricidad.">
                            <FormField control={form.control} name="printerCost" render={({ field }) => (
                                <FormItem><FormLabel>Costo de la Impresora (ARS)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="printerLifespan" render={({ field }) => (
                                <FormItem><FormLabel>Vida Útil (horas)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="printerPower" render={({ field }) => (
                                <FormItem><FormLabel>Potencia (Vatios)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="electricityCostKwh" render={({ field }) => (
                                <FormItem><FormLabel>Costo Electricidad (ARS/kWh)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </InputCard>
                        
                        <InputCard icon={Droplets} title="Filamento" description="Detalles de tu bobina de filamento.">
                            <FormField control={form.control} name="filamentCost" render={({ field }) => (
                                <FormItem><FormLabel>Costo Bobina (ARS)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="filamentWeight" render={({ field }) => (
                                <FormItem><FormLabel>Peso Bobina (g)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </InputCard>

                        <InputCard icon={Clock} title="Trabajo de Impresión" description="Detalles específicos del objeto que estás imprimiendo.">
                            <FormField control={form.control} name="printTimeHours" render={({ field }) => (
                                <FormItem><FormLabel>Tiempo de Impresión (horas)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="printWeightGrams" render={({ field }) => (
                                <FormItem><FormLabel>Filamento Usado (g)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </InputCard>

                        <InputCard icon={Briefcase} title="Mano de Obra, Gastos y Ganancia" description="Tu tiempo, tasa de fallos y margen de ganancia deseado.">
                            <FormField control={form.control} name="operatorHourlyRate" render={({ field }) => (
                                <FormItem><FormLabel>Tu Tarifa por Hora (ARS)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="postProcessingTimeMinutes" render={({ field }) => (
                                <FormItem><FormLabel>Post-procesado (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="failureRatePercent" render={({ field }) => (
                                <FormItem><FormLabel>Tasa de Fallos (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="desiredProfitMarginPercent" render={({ field }) => (
                                <FormItem><FormLabel>Margen de Ganancia (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </InputCard>
                    </div>

                    <div className="lg:col-span-1 space-y-4">
                        <Card className="sticky top-8 shadow-lg">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="w-6 h-6 text-accent" />
                                    <CardTitle>Resultados</CardTitle>
                                </div>
                                <CardDescription>Cálculo de costos y ganancias en vivo.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <ResultRow label="Costo de Máquina" value={results.machineDepreciationCost} />
                                <ResultRow label="Costo de Energía" value={results.electricityUsageCost} />
                                <ResultRow label="Costo de Filamento" value={results.filamentConsumedCost} />
                                <ResultRow label="Costo de Mano de Obra" value={results.operatorCost} />
                                <ResultRow label="Costo por Fallos" value={results.failureRiskCost} />

                                <Separator className="my-3"/>

                                <ResultRow label="Costo Total" value={results.totalCost} isBold={true} />
                                <ResultRow label="Ganancia" value={results.profitAmount} isBold={true} />
                                
                                <Separator className="my-3"/>

                                <div className="flex justify-between items-center text-3xl font-bold text-accent pt-2">
                                    <span>Precio de Venta</span>
                                    <span>{formatCurrency(results.sellingPrice)}</span>
                                </div>
                            </CardContent>
                            <CardFooter className="flex-col items-stretch space-y-2">
                                <Button onClick={handleSaveProfile} type="button"><Save className="mr-2 h-4 w-4" /> Guardar Perfil</Button>
                                <Button onClick={handleLoadProfile} type="button" variant="secondary"><FolderOpen className="mr-2 h-4 w-4" /> Cargar Perfil</Button>
                                <Button onClick={handleReset} type="button" variant="outline"><Trash2 className="mr-2 h-4 w-4" /> Restablecer</Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </form>
        </Form>
    );
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(value || 0);
};

const ResultRow = ({ label, value, isBold = false }: { label: string, value: number, isBold?: boolean }) => (
    <div className={cn("flex justify-between items-center text-sm transition-colors", isBold && "font-bold text-base mt-1")}>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground tracking-tight">{formatCurrency(value)}</span>
    </div>
);

const InputCard = ({ icon: Icon, title, description, children }: { icon: React.ElementType, title: string, description: string, children: React.ReactNode }) => (
    <Card className="overflow-hidden">
        <CardHeader>
            <div className="flex items-center gap-3">
                <Icon className="w-6 h-6 text-accent" />
                <CardTitle>{title}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
            {children}
        </CardContent>
    </Card>
);
