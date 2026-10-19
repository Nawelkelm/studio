import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth-provider"

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

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
    <html lang="es" suppressHydrationWarning className={`dark ${inter.variable}`}>
      <head>
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
