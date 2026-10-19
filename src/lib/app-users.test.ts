import { describe, expect, it } from "vitest";
import { actionsFor, isValidEmail, sortAppUsers } from "./app-users";
import type { AppUser } from "./supabase";

const user = (over: Partial<AppUser>): AppUser => ({
  email: "a@example.com", user_id: null, full_name: null, avatar_url: null, role: "user", status: "active",
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", last_login_at: null, ...over,
});

describe("sortAppUsers", () => {
  it("puts pending first, then active, then blocked, newest first within each group", () => {
    const sorted = sortAppUsers([
      user({ email: "blocked@x.com", status: "blocked" }),
      user({ email: "old-active@x.com", created_at: "2026-01-01T00:00:00Z" }),
      user({ email: "new-active@x.com", created_at: "2026-09-01T00:00:00Z" }),
      user({ email: "pending@x.com", status: "pending" }),
    ]);
    expect(sorted.map((u) => u.email)).toEqual(["pending@x.com", "new-active@x.com", "old-active@x.com", "blocked@x.com"]);
  });

  it("does not mutate its input", () => {
    const input = [user({ email: "b@x.com", status: "blocked" }), user({ email: "p@x.com", status: "pending" })];
    sortAppUsers(input);
    expect(input[0].email).toBe("b@x.com");
  });
});

describe("actionsFor", () => {
  const labels = (u: AppUser) => actionsFor(u, "admin@example.com").map((a) => a.label);

  it("offers approve, block and delete for a pending request", () => {
    expect(labels(user({ status: "pending" }))).toEqual(["Aprobar", "Bloquear", "Eliminar"]);
  });

  it("offers role change and block for active users, never delete", () => {
    expect(labels(user({ status: "active", role: "user" }))).toEqual(["Hacer admin", "Bloquear"]);
    expect(labels(user({ status: "active", role: "admin" }))).toEqual(["Quitar admin", "Bloquear"]);
  });

  it("offers reactivate and delete for blocked users", () => {
    expect(labels(user({ status: "blocked" }))).toEqual(["Reactivar", "Eliminar"]);
  });

  it("offers nothing on the admin's own row", () => {
    expect(actionsFor(user({ email: "admin@example.com", role: "admin" }), "Admin@Example.com")).toEqual([]);
  });

  it("asks for confirmation on destructive or privilege-changing actions only", () => {
    const byKind = Object.fromEntries(
      [user({ status: "pending" }), user({ status: "active" })].flatMap((u) => actionsFor(u, "x@x.com")).map((a) => [a.kind, a.confirm]),
    );
    expect(byKind).toMatchObject({ approve: false, block: true, "make-admin": true, delete: true });
  });

  it("keeps the user's role when approving or reactivating", () => {
    const approve = actionsFor(user({ status: "pending", role: "admin" }), "x@x.com")[0];
    expect(approve).toMatchObject({ kind: "approve", role: "admin", status: "active" });
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses and rejects malformed ones", () => {
    expect(isValidEmail(" persona@example.com ")).toBe(true);
    for (const bad of ["", "persona", "persona@", "@example.com", "a b@example.com", "persona@example"]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});
