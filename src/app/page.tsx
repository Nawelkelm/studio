import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calculator, Sparkles } from "lucide-react"
import CalculatorForm from "@/components/calculator-form"
import AiPricingAssistant from "@/components/ai-pricing-assistant"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 md:p-12">
      <div className="z-10 w-full max-w-5xl items-center justify-between text-center lg:flex my-8">
        <div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground tracking-tighter">
            Beneficio Impresión 3D
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Calcula costos, ganancias y obtén sugerencias de precios con IA para tus impresiones 3D.
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="calculator" className="w-full max-w-5xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calculator">
            <Calculator className="mr-2 h-4 w-4" />
            Calculadora
          </TabsTrigger>
          <TabsTrigger value="ai-assistant">
            <Sparkles className="mr-2 h-4 w-4" />
            Asistente de Precios IA
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calculator" className="mt-6">
          <CalculatorForm />
        </TabsContent>
        <TabsContent value="ai-assistant" className="mt-6">
          <AiPricingAssistant />
        </TabsContent>
      </Tabs>
    </main>
  );
}
