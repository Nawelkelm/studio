import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs supabase/migrations/20261019_user_management.sql on a real (in-memory) PostgreSQL, over a replica of the
// current Supabase setup: anon/authenticated roles, auth.jwt()/auth.uid(), and the printers/quotations tables
// with the policies that were in production before the migration.

const MIGRATION = readFileSync("supabase/migrations/20261019_user_management.sql", "utf8");

const ADMIN = { email: "kelmnahuel@gmail.com", sub: "00000000-0000-0000-0000-0000000000a1" };
const MEMBER = { email: "member@example.com", sub: "00000000-0000-0000-0000-0000000000b1" };
const STRANGER = { email: "stranger@example.com", sub: "00000000-0000-0000-0000-0000000000c1" };
const OLD_ACCOUNT = { email: "old@example.com", sub: "00000000-0000-0000-0000-0000000000d1" };
const PRINTER_ID = "00000000-0000-0000-0000-00000000f001";

type Who = { email: string; sub: string; provider?: string };

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

  -- Supabase grants everything on new public objects to anon/authenticated; RLS and the migration restrict it
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
  insert into public.quotations (user_id, client_name, selling_price, total_cost)
    values ('${ADMIN.sub}', 'Cliente existente', 10000, 4000);
`;

let db: PGlite;

async function asUser(who: Who | null, role: "authenticated" | "anon" = "authenticated") {
  const claims = who
    ? { sub: who.sub, email: who.email, app_metadata: { provider: who.provider ?? "google" } }
    : {};
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
  await db.exec(`set role ${role}`);
}

/** Runs one statement as `who` and always returns to the superuser. */
async function run(who: Who | null, sql: string, params: unknown[] = [], role: "authenticated" | "anon" = "authenticated") {
  await asUser(who, role);
  try {
    return (await db.query<Record<string, unknown>>(sql, params)).rows;
  } finally {
    // After a failed statement the transaction is aborted and this throws; the caller's savepoint rollback restores the role
    await db.exec("reset role").catch(() => undefined);
  }
}

/** Expects the statement to fail (RLS, grants or a raised exception) without aborting the surrounding transaction. */
async function expectFails(who: Who | null, sql: string, pattern: RegExp, params: unknown[] = [], role: "authenticated" | "anon" = "authenticated") {
  await db.exec("savepoint attempt");
  try {
    await expect(run(who, sql, params, role)).rejects.toThrow(pattern);
  } finally {
    await db.exec("rollback to savepoint attempt");
    await db.exec("reset role");
  }
}

const access = async (who: Who) => (await run(who, "select public.register_login($1, $2) as r", ["Nombre", null]))[0].r;
const upsert = (who: Who, email: string, role: string, status: string) =>
  run(who, "select public.admin_upsert_user($1, $2, $3)", [email, role, status]);
const countRows = async (who: Who | null, table: string, role: "authenticated" | "anon" = "authenticated") =>
  (await run(who, `select count(*)::int as n from public.${table}`, [], role))[0].n;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BASE_SCHEMA);
  await db.exec(MIGRATION);
}, 60_000);

afterAll(async () => { await db.close(); });
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("reset role"); await db.exec("rollback"); });

describe("migration", () => {
  it("seeds the admin as active and existing accounts as pending", async () => {
    const rows = (await db.query<{ email: string; role: string; status: string }>(
      "select email, role, status from public.app_users order by email")).rows;
    expect(rows).toEqual([
      { email: ADMIN.email, role: "admin", status: "active" },
      { email: OLD_ACCOUNT.email, role: "user", status: "pending" },
    ]);
  });

  it("can be applied twice (idempotent)", async () => {
    await db.exec("rollback"); // leave the per-test transaction; the migration manages its own
    await db.exec(MIGRATION);
    await db.exec("begin");
    const rows = (await db.query("select 1 from public.app_users")).rows;
    expect(rows.length).toBe(2);
  });
});

describe("registering logins", () => {
  it("registers a new account as pending", async () => {
    expect(await access(STRANGER)).toEqual({ status: "pending", role: "user" });
    const rows = await db.query("select user_id, full_name from public.app_users where email = $1", [STRANGER.email]);
    expect(rows.rows[0]).toEqual({ user_id: STRANGER.sub, full_name: "Nombre" });
  });

  it("returns the existing access for seeded and admin accounts", async () => {
    expect(await access(OLD_ACCOUNT)).toEqual({ status: "pending", role: "user" });
    expect(await access(ADMIN)).toEqual({ status: "active", role: "admin" });
  });

  it("matches the email case-insensitively", async () => {
    expect(await access({ ...ADMIN, email: "KelmNahuel@Gmail.com" })).toEqual({ status: "active", role: "admin" });
  });

  it("rejects logins that are not from Google and anonymous callers", async () => {
    await expectFails({ ...STRANGER, provider: "email" }, "select public.register_login()", /Google/);
    await expectFails(null, "select public.register_login()", /permission denied/, [], "anon");
  });
});

describe("data access", () => {
  it("hides everything from pending accounts and visitors", async () => {
    await access(STRANGER);
    expect(await countRows(STRANGER, "printers")).toBe(0);
    expect(await countRows(STRANGER, "quotations")).toBe(0);
    // visitors without a session have no table privileges at all
    await expectFails(null, "select count(*) from public.printers", /permission denied/, [], "anon");
    await expectFails(null, "select count(*) from public.quotations", /permission denied/, [], "anon");
  });

  it("denies writes to pending accounts", async () => {
    await access(STRANGER);
    await expectFails(STRANGER, `insert into public.quotations (user_id, client_name) values ('${STRANGER.sub}', 'x')`, /row-level security/);
    const updated = await run(STRANGER, "update public.printers set printer_power = 1 returning id");
    expect(updated).toEqual([]);
  });

  it("lets active users read and create their own quotations only", async () => {
    await upsert(ADMIN, MEMBER.email, "user", "active");
    await access(MEMBER);
    expect(await countRows(MEMBER, "printers")).toBe(1);
    expect(await countRows(MEMBER, "quotations")).toBe(1);
    await run(MEMBER, `insert into public.quotations (user_id, client_name) values ('${MEMBER.sub}', 'mío')`);
    await expectFails(MEMBER, `insert into public.quotations (user_id, client_name) values ('${ADMIN.sub}', 'a nombre de otro')`, /row-level security/);
  });

  it("limits updates to the preset columns of printers and the status of quotations", async () => {
    await upsert(ADMIN, MEMBER.email, "user", "active");
    await access(MEMBER);
    const preset = await run(MEMBER, "update public.printers set printer_power = 150, updated_at = now() returning printer_power");
    expect(preset).toEqual([{ printer_power: "150" }]);
    await expectFails(MEMBER, "update public.printers set name = 'hack'", /permission denied/);
    await run(MEMBER, "update public.quotations set status = 'aprobada', updated_at = now()");
    await expectFails(MEMBER, "update public.quotations set selling_price = 1", /permission denied/);
    await expectFails(MEMBER, `update public.quotations set user_id = '${MEMBER.sub}'`, /permission denied/);
    await expectFails(MEMBER, "delete from public.quotations", /permission denied/);
    await expectFails(MEMBER, "delete from public.printers", /permission denied/);
    await expectFails(MEMBER, "truncate public.quotations", /permission denied/);
    expect(await countRows(MEMBER, "quotations")).toBe(1); // nothing was lost
  });

  it("denies active accounts that do not come from Google", async () => {
    await upsert(ADMIN, MEMBER.email, "user", "active");
    expect(await countRows({ ...MEMBER, provider: "email" }, "printers")).toBe(0);
  });
});

describe("administration", () => {
  it("lets admins invite, approve, block and unblock; the change applies immediately", async () => {
    await upsert(ADMIN, MEMBER.email, "user", "active");
    expect(await countRows(MEMBER, "printers")).toBe(1);
    await upsert(ADMIN, MEMBER.email, "user", "blocked");
    expect(await countRows(MEMBER, "printers")).toBe(0);
    expect(await access(MEMBER)).toEqual({ status: "blocked", role: "user" });
    await upsert(ADMIN, MEMBER.email, "user", "active");
    expect(await countRows(MEMBER, "printers")).toBe(1);
  });

  it("keeps an invited account active when it signs in for the first time", async () => {
    await upsert(ADMIN, "Invitado@Example.com", "user", "active");
    const invited = { email: "invitado@example.com", sub: "00000000-0000-0000-0000-0000000000e1" };
    expect(await access(invited)).toEqual({ status: "active", role: "user" });
    expect(await countRows(invited, "printers")).toBe(1);
  });

  it("lets admins approve a pending request and promote another admin", async () => {
    await access(STRANGER);
    await upsert(ADMIN, STRANGER.email, "admin", "active");
    expect(await access(STRANGER)).toEqual({ status: "active", role: "admin" });
    await upsert(STRANGER, OLD_ACCOUNT.email, "user", "active"); // the new admin can manage users too
  });

  it("only shows the users list to admins", async () => {
    await upsert(ADMIN, MEMBER.email, "user", "active");
    expect(await countRows(ADMIN, "app_users")).toBe(3);
    expect(await countRows(MEMBER, "app_users")).toBe(0);
    expect(await countRows(STRANGER, "app_users")).toBe(0);
    await expectFails(null, "select count(*) from public.app_users", /permission denied/, [], "anon");
  });

  it("rejects user management from non-admins, pending accounts and visitors", async () => {
    await upsert(ADMIN, MEMBER.email, "user", "active");
    await expectFails(MEMBER, "select public.admin_upsert_user('x@example.com', 'admin', 'active')", /administradores/);
    await expectFails(MEMBER, `select public.admin_delete_user('${OLD_ACCOUNT.email}')`, /administradores/);
    await expectFails(STRANGER, `select public.admin_upsert_user('${STRANGER.email}', 'admin', 'active')`, /administradores/);
    await expectFails(null, "select public.admin_upsert_user('x@example.com', 'user', 'active')", /permission denied/, [], "anon");
    await expectFails(MEMBER, "update public.app_users set role = 'admin'", /permission denied/);
    await expectFails(MEMBER, "insert into public.app_users (email) values ('x@example.com')", /permission denied/);
  });

  it("stops a blocked admin from managing users", async () => {
    await upsert(ADMIN, STRANGER.email, "admin", "active");
    await upsert(ADMIN, STRANGER.email, "admin", "blocked");
    await expectFails(STRANGER, "select public.admin_upsert_user('x@example.com', 'user', 'active')", /administradores/);
  });

  it("stops admins from locking themselves out", async () => {
    await expectFails(ADMIN, `select public.admin_upsert_user('${ADMIN.email}', 'user', 'active')`, /a vos mismo/);
    await expectFails(ADMIN, `select public.admin_upsert_user('${ADMIN.email}', 'admin', 'blocked')`, /a vos mismo/);
    await expectFails(ADMIN, `select public.admin_delete_user('${ADMIN.email}')`, /a vos mismo/);
    expect(await access(ADMIN)).toEqual({ status: "active", role: "admin" });
  });

  it("deletes other accounts, which then return as pending", async () => {
    await upsert(ADMIN, MEMBER.email, "user", "active");
    await run(ADMIN, "select public.admin_delete_user($1)", [MEMBER.email]);
    expect(await countRows(MEMBER, "printers")).toBe(0);
    expect(await access(MEMBER)).toEqual({ status: "pending", role: "user" });
  });

  it("validates emails, roles and statuses", async () => {
    await expectFails(ADMIN, "select public.admin_upsert_user('not-an-email', 'user', 'active')", /email no es válido/);
    await expectFails(ADMIN, "select public.admin_upsert_user('ok@example.com', 'owner', 'active')", /inválido/);
    await expectFails(ADMIN, "select public.admin_upsert_user('ok@example.com', 'user', 'maybe')", /inválido/);
  });
});
