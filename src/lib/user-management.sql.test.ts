import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN, MEMBER, OLD_ACCOUNT, STRANGER, createHarness, readMigration, type Harness,
} from "./sql-test-harness";

// Runs supabase/migrations/20261019_user_management.sql on a real (in-memory) PostgreSQL, over a replica of the
// Supabase setup and the tables/policies that existed in production before the migration.

let h: Harness;
const MIGRATION = readMigration("20261019_user_management.sql");

beforeAll(async () => { h = await createHarness(["20261019_user_management.sql"]); }, 60_000);
afterAll(async () => { await h.close(); });
beforeEach(async () => { await h.begin(); });
afterEach(async () => { await h.rollback(); });

describe("migration", () => {
  it("seeds the admin as active and existing accounts as pending", async () => {
    const rows = (await h.db.query<{ email: string; role: string; status: string }>(
      "select email, role, status from public.app_users order by email")).rows;
    expect(rows).toEqual([
      { email: ADMIN.email, role: "admin", status: "active" },
      { email: OLD_ACCOUNT.email, role: "user", status: "pending" },
    ]);
  });

  it("can be applied twice (idempotent)", async () => {
    await h.db.exec("rollback"); // leave the per-test transaction; the migration manages its own
    await h.db.exec(MIGRATION);
    await h.db.exec("begin");
    const rows = (await h.db.query("select 1 from public.app_users")).rows;
    expect(rows.length).toBe(2);
  });
});

describe("registering logins", () => {
  it("registers a new account as pending", async () => {
    expect(await h.access(STRANGER)).toEqual({ status: "pending", role: "user" });
    const rows = await h.db.query("select user_id, full_name from public.app_users where email = $1", [STRANGER.email]);
    expect(rows.rows[0]).toEqual({ user_id: STRANGER.sub, full_name: "Nombre" });
  });

  it("returns the existing access for seeded and admin accounts", async () => {
    expect(await h.access(OLD_ACCOUNT)).toEqual({ status: "pending", role: "user" });
    expect(await h.access(ADMIN)).toEqual({ status: "active", role: "admin" });
  });

  it("matches the email case-insensitively", async () => {
    expect(await h.access({ ...ADMIN, email: "KelmNahuel@Gmail.com" })).toEqual({ status: "active", role: "admin" });
  });

  it("rejects logins that are not from Google and anonymous callers", async () => {
    await h.expectFails({ ...STRANGER, provider: "email" }, "select public.register_login()", /Google/);
    await h.expectFails(null, "select public.register_login()", /permission denied/, [], "anon");
  });
});

describe("data access", () => {
  it("hides everything from pending accounts and visitors", async () => {
    await h.access(STRANGER);
    expect(await h.countRows(STRANGER, "printers")).toBe(0);
    expect(await h.countRows(STRANGER, "quotations")).toBe(0);
    // visitors without a session have no table privileges at all
    await h.expectFails(null, "select count(*) from public.printers", /permission denied/, [], "anon");
    await h.expectFails(null, "select count(*) from public.quotations", /permission denied/, [], "anon");
  });

  it("denies writes to pending accounts", async () => {
    await h.access(STRANGER);
    await h.expectFails(STRANGER, `insert into public.quotations (user_id, client_name) values ('${STRANGER.sub}', 'x')`, /row-level security/);
    const updated = await h.run(STRANGER, "update public.printers set printer_power = 1 returning id");
    expect(updated).toEqual([]);
  });

  it("lets active users read and create their own quotations only", async () => {
    await h.upsert(ADMIN, MEMBER.email, "user", "active");
    await h.access(MEMBER);
    expect(await h.countRows(MEMBER, "printers")).toBe(1);
    expect(await h.countRows(MEMBER, "quotations")).toBe(2);
    await h.run(MEMBER, `insert into public.quotations (user_id, client_name) values ('${MEMBER.sub}', 'mío')`);
    await h.expectFails(MEMBER, `insert into public.quotations (user_id, client_name) values ('${ADMIN.sub}', 'a nombre de otro')`, /row-level security/);
  });

  it("limits updates to the preset columns of printers and the status of quotations", async () => {
    await h.upsert(ADMIN, MEMBER.email, "user", "active");
    await h.access(MEMBER);
    const preset = await h.run(MEMBER, "update public.printers set printer_power = 150, updated_at = now() returning printer_power");
    expect(preset).toEqual([{ printer_power: "150" }]);
    await h.expectFails(MEMBER, "update public.printers set name = 'hack'", /permission denied/);
    await h.run(MEMBER, "update public.quotations set status = 'aprobada', updated_at = now()");
    await h.expectFails(MEMBER, "update public.quotations set selling_price = 1", /permission denied/);
    await h.expectFails(MEMBER, `update public.quotations set user_id = '${MEMBER.sub}'`, /permission denied/);
    await h.expectFails(MEMBER, "delete from public.quotations", /permission denied/);
    await h.expectFails(MEMBER, "delete from public.printers", /permission denied/);
    await h.expectFails(MEMBER, "truncate public.quotations", /permission denied/);
    expect(await h.countRows(MEMBER, "quotations")).toBe(2); // nothing was lost
  });

  it("denies active accounts that do not come from Google", async () => {
    await h.upsert(ADMIN, MEMBER.email, "user", "active");
    expect(await h.countRows({ ...MEMBER, provider: "email" }, "printers")).toBe(0);
  });
});

describe("administration", () => {
  it("lets admins invite, approve, block and unblock; the change applies immediately", async () => {
    await h.upsert(ADMIN, MEMBER.email, "user", "active");
    expect(await h.countRows(MEMBER, "printers")).toBe(1);
    await h.upsert(ADMIN, MEMBER.email, "user", "blocked");
    expect(await h.countRows(MEMBER, "printers")).toBe(0);
    expect(await h.access(MEMBER)).toEqual({ status: "blocked", role: "user" });
    await h.upsert(ADMIN, MEMBER.email, "user", "active");
    expect(await h.countRows(MEMBER, "printers")).toBe(1);
  });

  it("keeps an invited account active when it signs in for the first time", async () => {
    await h.upsert(ADMIN, "Invitado@Example.com", "user", "active");
    const invited = { email: "invitado@example.com", sub: "00000000-0000-0000-0000-0000000000e1" };
    expect(await h.access(invited)).toEqual({ status: "active", role: "user" });
    expect(await h.countRows(invited, "printers")).toBe(1);
  });

  it("lets admins approve a pending request and promote another admin", async () => {
    await h.access(STRANGER);
    await h.upsert(ADMIN, STRANGER.email, "admin", "active");
    expect(await h.access(STRANGER)).toEqual({ status: "active", role: "admin" });
    await h.upsert(STRANGER, OLD_ACCOUNT.email, "user", "active"); // the new admin can manage users too
  });

  it("only shows the users list to admins", async () => {
    await h.upsert(ADMIN, MEMBER.email, "user", "active");
    expect(await h.countRows(ADMIN, "app_users")).toBe(3);
    expect(await h.countRows(MEMBER, "app_users")).toBe(0);
    expect(await h.countRows(STRANGER, "app_users")).toBe(0);
    await h.expectFails(null, "select count(*) from public.app_users", /permission denied/, [], "anon");
  });

  it("rejects user management from non-admins, pending accounts and visitors", async () => {
    await h.upsert(ADMIN, MEMBER.email, "user", "active");
    await h.expectFails(MEMBER, "select public.admin_upsert_user('x@example.com', 'admin', 'active')", /administradores/);
    await h.expectFails(MEMBER, `select public.admin_delete_user('${OLD_ACCOUNT.email}')`, /administradores/);
    await h.expectFails(STRANGER, `select public.admin_upsert_user('${STRANGER.email}', 'admin', 'active')`, /administradores/);
    await h.expectFails(null, "select public.admin_upsert_user('x@example.com', 'user', 'active')", /permission denied/, [], "anon");
    await h.expectFails(MEMBER, "update public.app_users set role = 'admin'", /permission denied/);
    await h.expectFails(MEMBER, "insert into public.app_users (email) values ('x@example.com')", /permission denied/);
  });

  it("stops a blocked admin from managing users", async () => {
    await h.upsert(ADMIN, STRANGER.email, "admin", "active");
    await h.upsert(ADMIN, STRANGER.email, "admin", "blocked");
    await h.expectFails(STRANGER, "select public.admin_upsert_user('x@example.com', 'user', 'active')", /administradores/);
  });

  it("stops admins from locking themselves out", async () => {
    await h.expectFails(ADMIN, `select public.admin_upsert_user('${ADMIN.email}', 'user', 'active')`, /a vos mismo/);
    await h.expectFails(ADMIN, `select public.admin_upsert_user('${ADMIN.email}', 'admin', 'blocked')`, /a vos mismo/);
    await h.expectFails(ADMIN, `select public.admin_delete_user('${ADMIN.email}')`, /a vos mismo/);
    expect(await h.access(ADMIN)).toEqual({ status: "active", role: "admin" });
  });

  it("deletes other accounts, which then return as pending", async () => {
    await h.upsert(ADMIN, MEMBER.email, "user", "active");
    await h.run(ADMIN, "select public.admin_delete_user($1)", [MEMBER.email]);
    expect(await h.countRows(MEMBER, "printers")).toBe(0);
    expect(await h.access(MEMBER)).toEqual({ status: "pending", role: "user" });
  });

  it("validates emails, roles and statuses", async () => {
    await h.expectFails(ADMIN, "select public.admin_upsert_user('not-an-email', 'user', 'active')", /email no es válido/);
    await h.expectFails(ADMIN, "select public.admin_upsert_user('ok@example.com', 'owner', 'active')", /inválido/);
    await h.expectFails(ADMIN, "select public.admin_upsert_user('ok@example.com', 'user', 'maybe')", /inválido/);
  });
});
