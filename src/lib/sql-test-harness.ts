import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect } from "vitest";

// In-memory PostgreSQL that replicates the Supabase pieces the migrations rely on (anon/authenticated roles,
// auth.jwt()/auth.uid(), default privileges) plus the printers/quotations tables as they were in production
// BEFORE any migration in supabase/migrations/. Tests then apply the real migration files in order.

export type Who = { email: string; sub: string; provider?: string };
type DbRole = "authenticated" | "anon";

export const ADMIN: Who = { email: "kelmnahuel@gmail.com", sub: "00000000-0000-0000-0000-0000000000a1" };
export const MEMBER: Who = { email: "member@example.com", sub: "00000000-0000-0000-0000-0000000000b1" };
export const STRANGER: Who = { email: "stranger@example.com", sub: "00000000-0000-0000-0000-0000000000c1" };
export const OLD_ACCOUNT: Who = { email: "old@example.com", sub: "00000000-0000-0000-0000-0000000000d1" };
export const PRINTER_ID = "00000000-0000-0000-0000-00000000f001";

export const readMigration = (file: string) => readFileSync(`supabase/migrations/${file}`, "utf8");

const BASE_SCHEMA = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}', last_sign_in_at timestamptz
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;

  -- Supabase grants everything on new public objects to anon/authenticated; RLS and the migrations restrict it
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;

  create table public.printers (
    id uuid primary key, name text not null, filament_cost_per_kg numeric, electricity_cost_kwh numeric,
    printer_power numeric, printer_lifespan numeric, printer_cost numeric, failure_rate_percent numeric,
    created_at timestamptz default now(), updated_at timestamptz default now()
  );
  create table public.quotations (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, user_name text, user_email text,
    client_name text not null, printer_id uuid, printer_name text, material_used text, print_weight_grams numeric,
    print_time_hours numeric, print_time_minutes numeric, quantity int, extra_costs numeric, profit_multiplier numeric,
    total_cost numeric, selling_price numeric, status text not null default 'pendiente', notes text,
    created_at timestamptz default now(), updated_at timestamptz default now()
  );
  alter table public.printers enable row level security;
  alter table public.quotations enable row level security;
  grant all on all tables in schema public to anon, authenticated;

  create policy "Printers readable by authenticated" on public.printers for select to authenticated using (true);
  create policy "Printers updatable by authenticated" on public.printers for update to authenticated using (true) with check (true);
  create policy "Quotations insertable by authenticated" on public.quotations for insert to authenticated with check (auth.uid() = user_id);
  create policy "Quotations readable by authenticated" on public.quotations for select to authenticated using (true);
  create policy "Quotations updatable by authenticated" on public.quotations for update to authenticated using (true) with check (true);

  insert into auth.users (id, email, last_sign_in_at) values
    ('${ADMIN.sub}', '${ADMIN.email}', now()),
    ('${OLD_ACCOUNT.sub}', '${OLD_ACCOUNT.email}', now());
  insert into public.printers (id, name, filament_cost_per_kg, electricity_cost_kwh, printer_power, printer_lifespan, printer_cost, failure_rate_percent)
    values ('${PRINTER_ID}', 'Ender 3', 15000, 140, 120, 4320, 150000, 30);
  insert into public.quotations (user_id, client_name, selling_price, total_cost, status)
    values ('${ADMIN.sub}', 'Cliente existente', 10000, 4000, 'aprobada'),
           ('${ADMIN.sub}', 'Cliente pendiente', 5000, 2000, 'pendiente');
`;

export type Harness = ReturnType<typeof bindHarness>;

function bindHarness(db: PGlite) {
  async function asUser(who: Who | null, role: DbRole) {
    const claims = who ? { sub: who.sub, email: who.email, app_metadata: { provider: who.provider ?? "google" } } : {};
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    await db.exec(`set role ${role}`);
  }

  /** Runs one statement as `who` and always returns to the superuser. */
  async function run(who: Who | null, sql: string, params: unknown[] = [], role: DbRole = "authenticated") {
    await asUser(who, role);
    try {
      return (await db.query<Record<string, unknown>>(sql, params)).rows;
    } finally {
      // After a failed statement the transaction is aborted and this throws; the savepoint rollback restores the role
      await db.exec("reset role").catch(() => undefined);
    }
  }

  /** Expects the statement to fail (RLS, grants or a raised exception) without aborting the surrounding transaction. */
  async function expectFails(who: Who | null, sql: string, pattern: RegExp, params: unknown[] = [], role: DbRole = "authenticated") {
    await db.exec("savepoint attempt");
    try {
      await expect(run(who, sql, params, role)).rejects.toThrow(pattern);
    } finally {
      await db.exec("rollback to savepoint attempt");
      await db.exec("reset role");
    }
  }

  return {
    db,
    run,
    expectFails,
    access: async (who: Who) => (await run(who, "select public.register_login($1, $2) as r", ["Nombre", null]))[0].r,
    upsert: (who: Who, email: string, role: string, status: string) =>
      run(who, "select public.admin_upsert_user($1, $2, $3)", [email, role, status]),
    countRows: async (who: Who | null, table: string, role: DbRole = "authenticated") =>
      (await run(who, `select count(*)::int as n from public.${table}`, [], role))[0].n as number,
    /** Per-test isolation: wrap each test in a transaction and roll it back. */
    begin: () => db.exec("begin"),
    rollback: async () => {
      await db.exec("reset role");
      await db.exec("rollback");
    },
    close: () => db.close(),
  };
}

/** Creates the replica schema and applies the given migration files, in order. */
export async function createHarness(migrations: string[]): Promise<Harness> {
  const db = new PGlite();
  await db.exec(BASE_SCHEMA);
  for (const file of migrations) await db.exec(readMigration(file));
  return bindHarness(db);
}
