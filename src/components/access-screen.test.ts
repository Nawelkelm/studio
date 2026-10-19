import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AccessScreen, { type AccessScreenKind } from "./access-screen";

const render = (kind: AccessScreenKind, message?: string) =>
  renderToStaticMarkup(
    h(AccessScreen, { kind, email: "persona@example.com", message, onRefresh: async () => {}, onSignOut: async () => {} }),
  );

describe("AccessScreen", () => {
  it("tells a pending account to wait for an administrator and lets it re-check", () => {
    const html = render("pending");
    expect(html).toContain("pendiente de aprobación");
    expect(html).toContain("persona@example.com");
    expect(html).toContain("Verificar de nuevo");
    expect(html).toContain("Cerrar sesión");
  });

  it("tells a blocked account it has no access, without a re-check button", () => {
    const html = render("blocked");
    expect(html).toContain("acceso está bloqueado");
    expect(html).not.toContain("Verificar de nuevo");
    expect(html).toContain("Cerrar sesión");
  });

  it("shows the technical detail and a retry button when the check failed", () => {
    const html = render("error", "Could not find the function public.register_login");
    expect(html).toContain("No pudimos verificar tu acceso");
    expect(html).toContain("Could not find the function public.register_login");
    expect(html).toContain("Reintentar");
  });
});
