import CalculatorForm from "@/components/calculator-form"

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

      <CalculatorForm />
    </main>
  );
}
