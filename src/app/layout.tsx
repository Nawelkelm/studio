import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth-provider"

export const metadata: Metadata = {
  title: 'Doji Print | Calculadora de Costos 3D',
  description: 'Doji Print - Impresiones 3D. Calculadora de costos y beneficios para impresión 3D, con sugerencias de precios por IA.',
  openGraph: {
    title: 'Doji Print | Calculadora de Costos 3D',
    description: 'Doji Print - Calculá el costo real de tus impresiones 3D. Material, electricidad, amortización y ganancia en un solo lugar.',
    type: 'website',
    locale: 'es_AR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Doji Print | Calculadora de Costos 3D',
    description: 'Doji Print - Calculá el costo real de tus impresiones 3D.',
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"></link>
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
