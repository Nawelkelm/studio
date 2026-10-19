"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Loader2, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";

import { supabase, type AppUser, type UserRole, type UserStatus } from "@/lib/supabase";
import { ROLE_LABEL, STATUS_LABEL, actionsFor, isValidEmail, sortAppUsers, type UserAction } from "@/lib/app-users";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_STYLE: Record<UserStatus, { variant: "outline" | "default" | "destructive"; className: string }> = {
  pending: { variant: "outline", className: "text-yellow-400" },
  active: { variant: "default", className: "" },
  blocked: { variant: "destructive", className: "" },
};

const initialsOf = (u: AppUser) =>
  (u.full_name || u.email).split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).join("").substring(0, 2).toUpperCase();

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "Nunca";

function confirmCopy(user: AppUser, action: UserAction) {
  switch (action.kind) {
    case "block":
      return { title: `¿Bloquear a ${user.email}?`, description: "No va a poder usar la herramienta ni ver ningún dato hasta que lo reactives." };
    case "make-admin":
      return { title: `¿Hacer administrador a ${user.email}?`, description: "Va a poder aprobar, bloquear, eliminar y cambiar el rol de otros usuarios." };
    case "remove-admin":
      return { title: `¿Quitar el rol de administrador a ${user.email}?`, description: "Va a seguir usando la herramienta, pero sin gestionar usuarios." };
    case "delete":
      return { title: `¿Eliminar a ${user.email}?`, description: "Se quita de la lista. Si vuelve a iniciar sesión, queda pendiente de aprobación." };
    default:
      return { title: "¿Confirmar?", description: "" };
  }
}

type Props = {
  currentEmail: string;
  /** Reports how many requests are waiting, to badge the tab */
  onPendingCountChange?: (count: number) => void;
};

export default function UserAdmin({ currentEmail, onPendingCountChange }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ user: AppUser; action: UserAction } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("user");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("app_users").select("*");
    if (error) {
      toast({ variant: "destructive", title: "No se pudieron cargar los usuarios", description: error.message });
    } else {
      const sorted = sortAppUsers((data ?? []) as AppUser[]);
      setUsers(sorted);
      onPendingCountChange?.(sorted.filter((u) => u.status === "pending").length);
    }
    setLoading(false);
  }, [toast, onPendingCountChange]);

  useEffect(() => { void load(); }, [load]);

  const pendingCount = useMemo(() => users.filter((u) => u.status === "pending").length, [users]);

  const apply = async (user: AppUser, action: UserAction) => {
    setBusyEmail(user.email);
    const { error } = action.kind === "delete"
      ? await supabase.rpc("admin_delete_user", { p_email: user.email })
      : await supabase.rpc("admin_upsert_user", { p_email: user.email, p_role: action.role, p_status: action.status });
    setBusyEmail(null);
    if (error) {
      toast({ variant: "destructive", title: "No se pudo completar la acción", description: error.message });
      return;
    }
    toast({ title: "Listo", description: `${action.label}: ${user.email}` });
    await load();
  };

  const request = (user: AppUser, action: UserAction) => {
    if (action.confirm) setConfirming({ user, action });
    else void apply(user, action);
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      toast({ variant: "destructive", title: "Email inválido", description: "Escribí una dirección de correo completa." });
      return;
    }
    if (users.some((u) => u.email === email)) {
      toast({ variant: "destructive", title: "Ya está en la lista", description: "Usá las acciones de la tabla para cambiar su acceso o su rol." });
      return;
    }
    setInviting(true);
    const { error } = await supabase.rpc("admin_upsert_user", { p_email: email, p_role: inviteRole, p_status: "active" });
    setInviting(false);
    if (error) {
      toast({ variant: "destructive", title: "No se pudo invitar", description: error.message });
      return;
    }
    toast({ title: "Usuario invitado", description: `${email} ya puede entrar con su cuenta de Google.` });
    setInviteEmail("");
    await load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserPlus className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Invitar a alguien</CardTitle>
              <CardDescription>
                Entra con su cuenta de Google y tiene acceso directo, sin esperar aprobación.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col sm:flex-row sm:items-end gap-3"
            onSubmit={(e) => { e.preventDefault(); void handleInvite(); }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">Email de Google</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="persona@gmail.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:w-44">
              <Label>Rol</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{ROLE_LABEL.user}</SelectItem>
                  <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="gap-2">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invitar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Usuarios y accesos</CardTitle>
                <CardDescription>
                  {pendingCount > 0
                    ? `${pendingCount} solicitud${pendingCount === 1 ? "" : "es"} esperando aprobación.`
                    : "Quién puede usar la herramienta. Las cuentas nuevas quedan pendientes hasta que las apruebes."}
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Actualizar">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && users.length === 0 ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const style = STATUS_STYLE[u.status];
                    const isMe = u.email === currentEmail.toLowerCase();
                    const actions = actionsFor(u, currentEmail);
                    return (
                      <TableRow key={u.email}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.avatar_url ?? ""} alt={u.full_name ?? u.email} />
                              <AvatarFallback className="text-xs">{initialsOf(u)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {u.full_name || u.email} {isMe && <span className="text-xs text-muted-foreground">(vos)</span>}
                              </p>
                              {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>{ROLE_LABEL[u.role]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={style.variant} className={`gap-1 ${style.className}`}>
                            {u.status === "pending" && <Clock className="h-3 w-3" />}
                            {STATUS_LABEL[u.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(u.last_login_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {busyEmail === u.email && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            {actions.map((a) => (
                              <Button
                                key={a.kind}
                                size="sm"
                                variant={a.kind === "approve" ? "default" : "outline"}
                                className={a.kind === "block" || a.kind === "delete" ? "text-red-400 hover:text-red-300" : ""}
                                disabled={busyEmail !== null}
                                onClick={() => request(u, a)}
                              >
                                {a.label}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => { if (!open) setConfirming(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming ? confirmCopy(confirming.user, confirming.action).title : ""}</AlertDialogTitle>
            <AlertDialogDescription>{confirming ? confirmCopy(confirming.user, confirming.action).description : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) void apply(confirming.user, confirming.action);
                setConfirming(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
