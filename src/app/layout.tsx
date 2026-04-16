import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'Beneficio Impresión 3D',
  description: 'Calculadora de costos y beneficios para impresión 3D, con sugerencias de precios por IA.',
  openGraph: {
    title: 'Calculadora de Costos 3D',
    description: 'Calculá el costo real de tus impresiones 3D. Material, electricidad, amortización y ganancia en un solo lugar.',
    type: 'website',
    locale: 'es_AR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculadora de Costos 3D',
    description: 'Calculá el costo real de tus impresiones 3D.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet"></link>
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
