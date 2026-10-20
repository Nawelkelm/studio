# Arquitectura

Guía para entender y revisar el código. Complementa el [README](../README.md) (cómo correrlo) y [PRODUCT.md](../PRODUCT.md) (para quién y por qué).

## 1. Vista general

```
Navegador (Next.js, cliente)                                 Servidor / servicios
─────────────────────────────                                ─────────────────────────────
AuthProvider ── Google OAuth ────────────────────────────►  Supabase Auth
   │  register_login() (RPC)  ───────────────────────────►  app_users (estado y rol)
   ▼
AppShell ── pantalla de acceso si la cuenta no está activa
   ├─ Cotizador  (calculator-form + components/quote/*) ──►  printers, quotations   (Supabase, RLS)
   │      └─ Asesor IA ── POST /api/suggest-pricing ──────►  route.ts (edge) ──►  Gemini
   │                                                              └─ lee quotations con el token del usuario
   ├─ Cotizaciones (quotation-registry + components/registry/*)
   └─ Usuarios (solo admin)  ── RPC admin_* ──────────────►  app_users
```

La **seguridad real está en la base de datos** (RLS, permisos por columna, funciones `security definer`). La interfaz solo oculta lo que el usuario no puede hacer.

## 2. Capas y carpetas

| Capa | Dónde | Regla |
|---|---|---|
| Lógica de dominio pura | `src/lib/*.ts` | Sin React ni red. Cálculos, filtros, métricas, armado de prompts, PDFs. Es lo que más cubren los tests. |
| Vistas | `src/components/**` | Lo que se puede, recibe datos y callbacks por props (p. ej. `RegistryView`), así se renderiza y prueba sin backend. |
| Contenedores | `quotation-registry.tsx`, `calculator-form.tsx`, `auth-provider.tsx` | Hablan con Supabase y conectan lógica con vistas. |
| API | `src/app/api/suggest-pricing/route.ts` | Única ruta de servidor (edge). |
| Base de datos | `supabase/migrations/*.sql` | Versionado del esquema; se aplica a mano. |
| UI base | `src/components/ui/*` | Componentes shadcn/Radix (varios sin uso, ver §7). |

### Módulos de `src/lib`

| Módulo | Responsabilidad |
|---|---|
| `calculator.ts` | Esquema (zod) y fórmulas de costo; `calculateLive`, margen, ganancia por hora, multiplicador para un precio objetivo; qué campos de la impresora se comparten con Supabase. |
| `quote-draft.ts` | Estado de lo que se escribe al guardar (cliente, pieza, canal, precio final…) y sus validaciones. |
| `quotation-meta.ts` | Canales, motivos de rechazo, fechas de vigencia, `QuotationSnapshot` (copia de costos). |
| `quotation-view.ts` | Datos derivados por fila (precio, margen, ganancia/h), búsqueda, filtros, orden, CSV. |
| `quotation-insights.ts` · `quotation-stats.ts` | Métricas de Rendimiento y ventas por mes. |
| `quote-prefill.ts` | Duplicar una cotización en el cotizador (con los costos de hoy). |
| `quotation-pdf.ts` · `registry-pdf.ts` | PDF para el cliente (sin costos internos) y listado interno. |
| `pricing-prompt.ts` · `price-advisor.ts` | Contrato con la IA: pedido validado, selección de cotizaciones parecidas (sin clientes), prompt, normalización de la respuesta; lado cliente del asesor. |
| `app-users.ts` | Etiquetas, orden y acciones permitidas en la pantalla de usuarios. |
| `supabase.ts` | Cliente (se crea al primer uso, no al importar) y tipos de las tablas. |
| `sql-test-harness.ts` | PostgreSQL en memoria (PGlite) que replica Supabase para probar las migraciones. |

## 3. Modelo de datos

- **`printers`**: costos compartidos por impresora (filamento/kg, electricidad/kWh, potencia, vida útil, precio, tasa de fallos). Hoy se cargan a mano en Supabase; la app solo las lee y actualiza esos 6 valores.
- **`quotations`**: una fila por cotización guardada. Además de montos y datos de la pieza, guarda `final_price` (lo realmente cobrado), `channel`, `piece_name`, `client_contact`, `valid_until`, `internal_notes`, `snapshot` (jsonb con los costos y resultados usados), `lost_reason` y `decided_at`. `selling_price` es el precio *calculado*; `final_price` puede diferir (descuento). `notes` es un campo viejo (JSON), ya no se escribe.
- **`app_users`**: `email`, `status` (`pending`/`active`/`blocked`), `role` (`admin`/`user`). Se llena al iniciar sesión (`register_login`) o por invitación.

Reglas que garantiza la base, vengan del cliente que vengan:
- Solo cuentas `active` (y entradas por Google) leen o escriben `printers` y `quotations`.
- Un usuario solo puede insertar cotizaciones a su propio nombre (`auth.uid() = user_id`).
- `UPDATE` por columna: en `printers`, solo los 6 valores y `updated_at`; en `quotations`, solo estado, motivo, precio final, vigencia, notas, contacto, canal, pieza y descripción. Montos calculados, copia de costos y autor son inmutables.
- No hay permiso de `DELETE` ni `TRUNCATE` para usuarios.
- Un trigger mantiene `decided_at` (según el estado) y limpia `lost_reason` si la cotización no está rechazada.
- Un admin no puede bloquearse, degradarse ni eliminarse a sí mismo: siempre queda al menos uno.

## 4. Flujos principales

**Cotizar.** El formulario (`react-hook-form` + zod) emite valores crudos (textos); `calculateLive` los valida y calcula en vivo. Los 6 valores de la impresora se editan de forma deliberada: nada se guarda hasta "Guardar para todo el equipo". Los datos de la pieza se recuerdan por impresora en `localStorage`.

**Guardar.** `saveQuotation` inserta la fila con precio calculado, precio final y la copia de costos. Una firma de los datos evita duplicados al guardar dos veces lo mismo. El PDF usa el precio final y la vigencia, y nunca incluye costos.

**Estado y rechazo.** Desde el detalle: rechazar exige un motivo; la fecha de decisión la pone la base.

**Duplicar.** El registro entrega un `QuotePrefill` al shell, que cambia a la calculadora; allí se aplica una sola vez por `key` (impresora, pieza, cliente y canal; los costos son los de hoy).

**Asesor IA.** El navegador envía pieza, costo por unidad y canal con el token de sesión. La ruta (1) valida sesión, (2) verifica `is_active_user`, (3) limita 10 consultas/minuto, (4) valida el cuerpo, (5) lee hasta 100 cotizaciones cerradas con el permiso del propio usuario y **sin columnas de cliente**, (6) elige las parecidas, (7) pide a Gemini una respuesta estructurada (`responseSchema`), (8) la valida y la normaliza: nunca por debajo del costo, ordenada, en pesos enteros. Prueba con varios modelos en orden si uno falla.

**Acceso.** `AuthProvider` llama a `register_login` tras cada login. `AppShell` solo monta la app si el estado es `active`; si no, muestra `AccessScreen`. Los admins ven la pestaña Usuarios.

## 5. Pruebas

`npm test` ejecuta toda la suite (Vitest):
- lógica pura (cálculos, filtros, métricas, prompt, normalización de la IA);
- renderizado en servidor de vistas clave (`renderToStaticMarkup`);
- generación real de PDFs con jsPDF;
- **migraciones SQL** sobre PostgreSQL en memoria: acceso por rol, permisos por columna, triggers, idempotencia;
- la **ruta de IA** completa con toda la red simulada.

Datos de ejemplo realistas (impresoras Bambu Lab A1/P1S y Snapmaker U1) en `src/lib/quotation-fixtures.ts`.

## 6. Dónde conviene mirar con más atención al revisar

1. **`supabase/migrations/*.sql`**: es el control de acceso real. Revisá `is_active_user`/`is_admin` (usan el claim `email` y el proveedor `google` del JWT), los `grant`/`revoke` por columna y los triggers.
2. **`src/components/calculator-form.tsx`** (~400 líneas): orquestador con varios `useEffect` encadenados (carga de impresoras → selección → duplicado → persistencia local). Es la pieza más densa y la menos cubierta por tests (solo se prueban sus partes puras).
3. **`src/app/api/suggest-pricing/route.ts`**: orden de las verificaciones, qué datos salen hacia Gemini y manejo de errores sin filtrar detalles internos.
4. **`src/lib/calculator.ts`**: fórmulas de costo y de precio en MercadoLibre (`precio / (1 − comisión)`, comisión fija del 16 %).
5. **`src/components/auth-provider.tsx` y `app-shell.tsx`**: puerta de acceso y estados de carga/error.
6. **Zonas horarias**: meses, vigencias y "vencida" se calculan con la hora local del navegador.

## 7. Limitaciones conocidas y deuda

- **El esquema base de `printers` y `quotations` no está en el repositorio** (es anterior a las migraciones). Los tests lo replican a mano. Conviene exportarlo (`pg_dump --schema-only`) como migración base.
- **Sin integración continua** ni pruebas end-to-end; el login con Google, el flujo con sesión real y el orquestador del cotizador no tienen prueba automática.
- El registro **carga todas las cotizaciones** en el navegador (sin paginación en servidor): bien para cientos, a revisar con miles.
- El límite de consultas a la IA es **por instancia** del servidor (frena ráfagas, no es una cuota global).
- Los datos del negocio para el PDF (CUIT, dirección, teléfono) se guardan **en el navegador**, por dispositivo.
- `useIsMobile` empieza en `false` y puede mostrar un instante el panel lateral antes de pasar a la hoja inferior en celulares.
- **Código sin uso:** 16 componentes de `components/ui` (accordion, alert, calendar, carousel, chart, checkbox, menubar, popover, progress, radio-group, scroll-area, separator, sidebar, slider, switch, tooltip) y sus dependencias (`date-fns`, `react-day-picker`, `embla-carousel-react` y varios `@radix-ui/*`); `remotePatterns` de `placehold.co` en `next.config.ts`; `docs/blueprint.md` (describe una versión anterior).
- **Dependencias:** Tailwind 3 (la 4 cambia la configuración y las clases); quedan 6 avisos altos de `npm audit`, todos de herramientas de compilación de Tailwind, no del sitio publicado.
