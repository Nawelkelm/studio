import type { AppUser, UserRole, UserStatus } from "@/lib/supabase";

export const STATUS_LABEL: Record<UserStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  blocked: "Bloqueado",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  user: "Usuario",
};

const STATUS_ORDER: Record<UserStatus, number> = { pending: 0, active: 1, blocked: 2 };

/** Pending requests first (they need attention), then active, then blocked; newest first inside each group. */
export function sortAppUsers(users: AppUser[]): AppUser[] {
  return [...users].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      b.created_at.localeCompare(a.created_at) ||
      a.email.localeCompare(b.email),
  );
}

export type UserAction =
  | { kind: "approve"; label: string; role: UserRole; status: "active"; confirm: false }
  | { kind: "block"; label: string; role: UserRole; status: "blocked"; confirm: true }
  | { kind: "make-admin"; label: string; role: "admin"; status: "active"; confirm: true }
  | { kind: "remove-admin"; label: string; role: "user"; status: "active"; confirm: true }
  | { kind: "delete"; label: string; confirm: true };

/** Actions an admin can take on a row. Nobody can act on their own row (the database enforces it too). */
export function actionsFor(user: AppUser, currentEmail: string): UserAction[] {
  if (user.email === currentEmail.toLowerCase()) return [];
  const actions: UserAction[] = [];
  if (user.status === "pending") actions.push({ kind: "approve", label: "Aprobar", role: user.role, status: "active", confirm: false });
  if (user.status === "blocked") actions.push({ kind: "approve", label: "Reactivar", role: user.role, status: "active", confirm: false });
  if (user.status === "active") {
    actions.push(
      user.role === "admin"
        ? { kind: "remove-admin", label: "Quitar admin", role: "user", status: "active", confirm: true }
        : { kind: "make-admin", label: "Hacer admin", role: "admin", status: "active", confirm: true },
    );
  }
  if (user.status !== "blocked") actions.push({ kind: "block", label: "Bloquear", role: user.role, status: "blocked", confirm: true });
  if (user.status !== "active") actions.push({ kind: "delete", label: "Eliminar", confirm: true });
  return actions;
}

export const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
