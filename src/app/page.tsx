import CalculatorForm from "@/components/calculator-form"
import AiPricingAssistant from "@/components/ai-pricing-assistant"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calculator, Sparkles } from "lucide-react"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 md:p-12">
      <div className="z-10 w-full max-w-5xl items-center justify-between text-center lg:flex my-8">
        <div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground tracking-tighter">
            Calculadora de Costos 3D
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Calcula los costos de tus impresiones 3D con precisión.
          </p>
        </div>
      </div>

      <Tabs defaultValue="calculator" className="w-full max-w-7xl">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" /> Calculadora
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" /> Asistente IA
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calculator">
          <CalculatorForm />
        </TabsContent>
        <TabsContent value="ai">
          <div className="max-w-2xl mx-auto">
            <AiPricingAssistant />
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
