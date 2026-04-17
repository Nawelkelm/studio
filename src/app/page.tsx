import CalculatorForm from "@/components/calculator-form"
import AiPricingAssistant from "@/components/ai-pricing-assistant"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calculator, Sparkles } from "lucide-react"
import Image from "next/image"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 md:p-12">
      <div className="z-10 w-full max-w-5xl flex flex-col items-center justify-center text-center my-8 gap-4">
        <Image
          src="/logo.png"
          alt="Doji Print - Impresiones 3D"
          width={180}
          height={180}
          className="rounded-2xl shadow-2xl shadow-primary/20"
          priority
        />
        <div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-extrabold text-foreground tracking-tighter">
            Doji Print
          </h1>
          <p className="mt-2 text-lg text-primary font-semibold tracking-wide uppercase">
            Impresiones 3D
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
            Calculá los costos de tus impresiones 3D con precisión y obtené sugerencias de precios con IA.
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
