"use client";

import { useAuth } from "@/components/auth-provider";
import LoginScreen from "@/components/login-screen";
import CalculatorForm from "@/components/calculator-form";
import AiPricingAssistant from "@/components/ai-pricing-assistant";
import QuotationRegistry from "@/components/quotation-registry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calculator, Sparkles, ClipboardList, LogOut, Loader2 } from "lucide-react";
import Image from "next/image";

export default function AppShell() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const userName = user.user_metadata?.full_name || user.email || "";
  const userAvatar = user.user_metadata?.avatar_url || "";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 md:p-12">
      {/* User bar */}
      <div className="w-full max-w-7xl flex justify-end mb-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userAvatar} alt={userName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground hidden sm:inline">{userName}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="z-10 w-full max-w-5xl flex flex-col items-center justify-center text-center mb-8 gap-4">
        <Image
          src="/logo.png"
          alt="Doji Print - Impresiones 3D"
          width={140}
          height={140}
          className="rounded-2xl shadow-2xl shadow-primary/20"
          priority
        />
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold text-foreground tracking-tighter">
            Doji Print
          </h1>
          <p className="mt-1 text-sm text-primary font-semibold tracking-wide uppercase">
            Impresiones 3D
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calculator" className="w-full max-w-7xl">
        <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-8">
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" /> <span className="hidden sm:inline">Calculadora</span>
          </TabsTrigger>
          <TabsTrigger value="registry" className="gap-2">
            <ClipboardList className="h-4 w-4" /> <span className="hidden sm:inline">Cotizaciones</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Asistente IA</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calculator">
          <CalculatorForm />
        </TabsContent>
        <TabsContent value="registry">
          <QuotationRegistry />
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
