"use client";

import { useState } from "react";
import Image from "next/image";
import { Clock, Loader2, LogOut, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type AccessScreenKind = "pending" | "blocked" | "error";

const COPY: Record<AccessScreenKind, { title: string; description: string; icon: typeof Clock }> = {
  pending: {
    title: "Tu cuenta está pendiente de aprobación",
    description: "Un administrador tiene que darte acceso. Avisale que ya iniciaste sesión y volvé a verificar en unos minutos.",
    icon: Clock,
  },
  blocked: {
    title: "Tu acceso está bloqueado",
    description: "Si creés que es un error, hablá con un administrador de Doji Print.",
    icon: ShieldAlert,
  },
  error: {
    title: "No pudimos verificar tu acceso",
    description: "Intentá de nuevo. Si el problema sigue, avisale a un administrador.",
    icon: TriangleAlert,
  },
};

type Props = {
  kind: AccessScreenKind;
  email: string;
  /** Technical detail shown for the "error" kind */
  message?: string | null;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export default function AccessScreen({ kind, email, message, onRefresh, onSignOut }: Props) {
  const [checking, setChecking] = useState(false);
  const { title, description, icon: Icon } = COPY[kind];

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-4">
          <Image src="/logo.png" alt="Doji Print" width={96} height={96} className="rounded-2xl shadow-lg shadow-primary/20" priority />
          <div className="space-y-2">
            <Icon className="mx-auto h-8 w-8 text-primary" />
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sesión iniciada como <span className="font-medium text-foreground">{email}</span>
          </p>
          {kind === "error" && message && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground break-words">
              {message}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {kind !== "blocked" && (
              <Button onClick={handleRefresh} disabled={checking} className="gap-2">
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {kind === "error" ? "Reintentar" : "Verificar de nuevo"}
              </Button>
            )}
            <Button variant="outline" onClick={onSignOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
