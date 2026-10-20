"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth-provider";
import type { QuotePrefill } from "@/lib/quote-prefill";
import { supabase } from "@/lib/supabase";
import LoginScreen from "@/components/login-screen";
import AccessScreen from "@/components/access-screen";
import CalculatorForm from "@/components/calculator-form";
import QuotationRegistry from "@/components/quotation-registry";
import UserAdmin from "@/components/user-admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calculator, ClipboardList, LogOut, Loader2, Users } from "lucide-react";
import Image from "next/image";

export default function AppShell() {
  const { user, loading, access, accessLoading, accessError, refreshAccess, signOut } = useAuth();

  if (loading || accessLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Nothing of the app mounts (and no data is requested) until an administrator has approved the account
  const email = user.email ?? "";
  if (accessError || !access) {
    return <AccessScreen kind="error" email={email} message={accessError} onRefresh={refreshAccess} onSignOut={signOut} />;
  }
  if (access.status !== "active") {
    return <AccessScreen kind={access.status} email={email} onRefresh={refreshAccess} onSignOut={signOut} />;
  }

  return <AuthenticatedApp user={user} isAdmin={access.role === "admin"} onSignOut={signOut} />;
}

function AuthenticatedApp({ user, isAdmin, onSignOut }: { user: User; isAdmin: boolean; onSignOut: () => Promise<void> }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [tab, setTab] = useState("calculator");
  // A quotation chosen in the registry to be duplicated in the calculator
  const [prefill, setPrefill] = useState<QuotePrefill | null>(null);

  // Admins get a badge on the Users tab when someone is waiting for approval
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("app_users")
      .select("email", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [isAdmin]);

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
          {isAdmin && <Badge variant="secondary" className="hidden sm:inline-flex">Admin</Badge>}
          <Button variant="ghost" size="sm" onClick={onSignOut} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar sesión">
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
      <Tabs value={tab} onValueChange={setTab} className="w-full max-w-7xl">
        <TabsList className={`grid w-full mx-auto mb-8 ${isAdmin ? "max-w-lg grid-cols-3" : "max-w-sm grid-cols-2"}`}>
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" /> <span className="hidden sm:inline">Calculadora</span>
          </TabsTrigger>
          <TabsTrigger value="registry" className="gap-2">
            <ClipboardList className="h-4 w-4" /> <span className="hidden sm:inline">Cotizaciones</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" /> <span className="hidden sm:inline">Usuarios</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-yellow-500 px-1.5 text-[10px] font-bold leading-4 text-black">{pendingCount}</span>
              )}
            </TabsTrigger>
          )}
        </TabsList>
        {/* The calculator stays mounted (hidden when inactive) so results and typed data survive tab switches.
            The registry and users tabs unmount on purpose: they reload their data every time they are opened. */}
        <TabsContent value="calculator" forceMount className="data-[state=inactive]:hidden">
          <CalculatorForm onNavigate={setTab} prefill={prefill} />
        </TabsContent>
        <TabsContent value="registry">
          <QuotationRegistry
            onDuplicate={(p) => { setPrefill(p); setTab("calculator"); }}
            onGoToCalculator={() => setTab("calculator")}
          />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="users">
            <UserAdmin currentEmail={user.email ?? ""} onPendingCountChange={setPendingCount} />
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}
