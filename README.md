# Doji Print · Cotizador de impresión 3D

Herramienta interna de Doji Print (impresión 3D, Argentina) para **calcular el costo real de una pieza, cotizarla, registrar la cotización y decidir mejor** con los datos acumulados.

- **Cotizador:** precio, margen y ganancia por hora de impresión en vivo; valores de impresora compartidos; cotización guardada junto con una copia de los costos usados; PDF para el cliente (sin costos internos).
- **Cotizaciones:** búsqueda y filtros, detalle, estado con motivo de rechazo, duplicar, exportar PDF/CSV, y una vista de **Rendimiento** (ganancia por hora por material e impresora, canales, clientes, motivos de pérdida).
- **Asesor de precio con IA (Gemini):** propone un rango por unidad a partir del costo real y de cotizaciones parecidas ya cerradas (sin nombres de clientes).
- **Usuarios:** entrada con Google; un administrador aprueba, bloquea o invita desde la app.

Contexto de producto en [PRODUCT.md](PRODUCT.md). Cómo está armado por dentro en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

Next.js 15 (App Router) · React 18 · TypeScript estricto · Tailwind CSS 3 + shadcn/ui (Radix) · Supabase (Auth con Google + Postgres con RLS) · Gemini (API REST) · jsPDF · recharts · Vitest. Deploy en Vercel.

## Puesta en marcha

Requisitos: Node 22 o superior (Vercel usa 24.x) y un proyecto de Supabase con las migraciones aplicadas.

```bash
npm install
cp .env.example .env.local   # completá los 3 valores (ver abajo)
npm run dev                  # http://localhost:9002
```

Variables de entorno (en `.env.local` y en Vercel → Settings → Environment Variables):

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave pública (anon) de Supabase |
| `GOOGLE_GENAI_API_KEY` | clave de Gemini, solo se usa en el servidor (`/api/suggest-pricing`) |

Para iniciar sesión en local, agregá `http://localhost:9002/**` en Supabase → Authentication → URL Configuration → Redirect URLs.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo (puerto 9002) |
| `npm run build` / `npm start` | build y servidor de producción |
| `npm test` | suite completa de tests (Vitest, incluye migraciones SQL y la ruta de IA) |
| `npm run lint` | ESLint (`eslint .`) |
| `npm run typecheck` | `tsc --noEmit` |

## Base de datos

Los cambios de esquema viven en [`supabase/migrations/`](supabase/migrations/) y se aplican **a mano, en orden**, en el SQL Editor de Supabase (cada archivo es una transacción y se puede volver a correr):

1. `20261019_user_management.sql`: usuarios, roles, funciones y políticas de acceso.
2. `20261020_quotation_decision_data.sql`: datos para decidir en `quotations` (pieza, canal, precio final, motivo de rechazo, copia de costos…).

Las migraciones se prueban contra un PostgreSQL real en memoria (PGlite) que replica Supabase: `npm test` las ejecuta. Aplicá siempre la migración **antes** de desplegar el código que la usa.

## Deploy

Vercel está conectado a GitHub (`Nawelkelm/studio`). **Cada push a la rama `3D-Print-Profit` despliega a producción.** Para volver atrás: `vercel rollback <url-del-deploy-anterior>` o *Promote to Production* sobre un deploy anterior en el panel de Vercel. Los datos no se tocan.

## Antes de subir cambios

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

No hay integración continua configurada: estas comprobaciones corren solo en tu máquina.
