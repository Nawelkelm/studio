# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Doji Print, a small 3D-printing business in Argentina (prices in ARS, Spanish with voseo). The people who use the tool are the owner and the few teammates an administrator has approved.

They quote custom print jobs for customers and are confirmed to work **from phone and desktop equally**. Both situations are habitual, so the interface has to be fast and comfortable on a small screen and dense enough on a large one.

Primary job: turn a piece (weight, print time, quantity, material) into a defensible price, hand the customer a quotation, and keep a record of it.

## Product Purpose

Calculate the real cost and the selling price of a 3D print, issue a client-facing quotation PDF, keep a shared registry of quotations, and suggest prices with an AI assistant. Success is quoting quickly with confidence in the margin, and being able to learn from past quotations.

The owner wants the stored data to support four decisions (confirmed): **how much to charge**, **which customers and channels perform best**, **which jobs are worth accepting**, and **why sales are lost**.

## Positioning

Inferred from the code, not confirmed by the user: costs are computed from the shop's own printers (shared presets: filament, electricity, machine depreciation, failure rate), with an MercadoLibre price that accounts for its fee, and the AI assistant is grounded in the calculated cost.

## Operating Context

- Quoting happens with a customer waiting (chat, marketplace, in person) and also at a desk with time to spare.
- The PDF the customer receives must show a single commercial service line and total; internal costs never appear on it. The internal breakdown stays in the quotation record (`quotations.notes`).
- Access is controlled by administrators: new accounts wait for approval; roles are admin and user.
- Printer values (filament cost per kg, electricity, power, lifespan, price, failure rate) are shared by every active user, and every active user may edit them (confirmed decision).
- Database changes go through versioned, tested migrations in `supabase/migrations/`.

## Capabilities and Constraints

- Stack: Next.js 15 (App Router), React 18, Tailwind CSS 3, shadcn/ui on Radix, recharts, jsPDF; Supabase (Google login, Postgres with RLS); deployed on Vercel from the `3D-Print-Profit` branch (every push to it deploys to production).
- Today: calculator with printer selection, batch quantity, profit multiplier, MercadoLibre price; quotation registry with status (pendiente / aprobada / rechazada), monthly sales dashboard; AI price assistant (Gemini) that can use the last calculation; admin panel for users.
- The calculator should show results **live while typing** (confirmed preference), without a Calcular button.
- Language: Spanish (Argentina), voseo, currency ARS.
- Open decisions: exact set of new fields to store (see Product Purpose for the decisions they must serve); whether the incumbent look is to be kept or replaced (not discussed).

## Brand Commitments

Name "Doji Print", tagline "Impresiones 3D", logo at `public/logo.png`. The current interface is dark with violet accents; the user has not said whether that look is binding.

## Evidence on Hand

- Real logo asset: `public/logo.png`.
- A few real quotations in the registry (owner's data). No testimonials, customer case studies or benchmarks exist; do not invent any.

## Product Principles

1. **Quote in seconds, from any screen.** Typing a piece's data should immediately show cost, price and margin.
2. **Every quotation should teach the next one.** What is stored must serve pricing, job selection, customer/channel performance and lost-sale analysis.
3. **The customer sees a quotation; the shop sees the truth.** Client documents are commercial; internal costs and margins stay internal.
4. **Price suggestions are grounded in the shop's own numbers**, never generic guesses.
5. **Access is deliberate.** Only approved people see data; shared values are edited on purpose, not by accident.

## Accessibility & Inclusion

No product-specific requirement has been established.
