import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN, MEMBER, STRANGER, createHarness, readMigration, type Harness } from "./sql-test-harness";

// supabase/migrations/20261020_quotation_decision_data.sql applied after the user-management migration,
// over quotations that already existed (the harness seeds an approved and a pending one).

let h: Harness;
const MIGRATION = readMigration("20261020_quotation_decision_data.sql");

const insertQuotation = (who: typeof MEMBER) =>
  h.run(
    who,
    `insert into public.quotations (user_id, client_name, selling_price, total_cost, piece_name, channel, final_price, snapshot)
     values ('${who.sub}', 'Cliente nuevo', 9000, 3000, 'Llavero dragón', 'mercadolibre', 8500, '{"v":1,"inputs":{"filamentCostPerKg":15000}}'::jsonb)
     returning id`,
  );

const pendingId = async () =>
  ((await h.db.query<{ id: string }>("select id from public.quotations where client_name = 'Cliente pendiente'")).rows[0].id);

const row = async (id: string) =>
  (await h.db.query<Record<string, unknown>>("select * from public.quotations where id = $1", [id])).rows[0];

beforeAll(async () => {
  h = await createHarness(["20261019_user_management.sql", "20261020_quotation_decision_data.sql"]);
}, 60_000);
afterAll(async () => { await h.close(); });
beforeEach(async () => {
  await h.begin();
  await h.upsert(ADMIN, MEMBER.email, "user", "active");
});
afterEach(async () => { await h.rollback(); });

describe("existing data", () => {
  it("backfills the final price, the channel and the decision date of old quotations", async () => {
    const rows = (await h.db.query<{ client_name: string; final_price: string; channel: string; decided: boolean }>(
      "select client_name, final_price, channel, decided_at is not null as decided from public.quotations order by client_name")).rows;
    expect(rows).toEqual([
      { client_name: "Cliente existente", final_price: "10000", channel: "directo", decided: true },
      { client_name: "Cliente pendiente", final_price: "5000", channel: "directo", decided: false },
    ]);
  });

  it("can be applied twice (idempotent)", async () => {
    await h.db.exec("rollback");
    await h.db.exec(MIGRATION);
    await h.db.exec("begin");
    expect((await h.db.query("select 1 from public.quotations")).rows.length).toBe(2);
  });
});

describe("creating quotations", () => {
  it("stores the decision data, including the cost snapshot", async () => {
    const [{ id }] = await insertQuotation(MEMBER);
    const q = await row(id as string);
    expect(q).toMatchObject({ piece_name: "Llavero dragón", channel: "mercadolibre", status: "pendiente" });
    expect(q.final_price).toBe("8500");
    expect(q.snapshot).toEqual({ v: 1, inputs: { filamentCostPerKg: 15000 } });
    expect(q.decided_at).toBeNull();
  });

  it("rejects unknown channels, negative final prices and over-long texts", async () => {
    const bad = (cols: string, vals: string, pattern: RegExp) =>
      h.expectFails(MEMBER, `insert into public.quotations (user_id, client_name, ${cols}) values ('${MEMBER.sub}', 'x', ${vals})`, pattern);
    await bad("channel", "'telegram'", /quotations_channel_check/);
    await bad("final_price", "-1", /quotations_final_price_check/);
    await bad("piece_name", `'${"x".repeat(121)}'`, /quotations_text_length_check/);
    await bad("internal_notes", `'${"x".repeat(1001)}'`, /quotations_text_length_check/);
  });

  it("still rejects pending accounts", async () => {
    await h.access(STRANGER);
    await h.expectFails(STRANGER, `insert into public.quotations (user_id, client_name) values ('${STRANGER.sub}', 'x')`, /row-level security/);
  });
});

describe("deciding a quotation", () => {
  it("sets decided_at when approved or rejected and clears it when reopened", async () => {
    const id = await pendingId();
    await h.run(MEMBER, "update public.quotations set status = 'aprobada' where id = $1", [id]);
    expect((await row(id)).decided_at).not.toBeNull();
    await h.run(MEMBER, "update public.quotations set status = 'pendiente' where id = $1", [id]);
    expect((await row(id)).decided_at).toBeNull();
    await h.run(MEMBER, "update public.quotations set status = 'rechazada' where id = $1", [id]);
    expect((await row(id)).decided_at).not.toBeNull();
  });

  it("keeps decided_at when only other fields change", async () => {
    const id = await pendingId();
    await h.run(MEMBER, "update public.quotations set status = 'aprobada' where id = $1", [id]);
    await h.db.exec(`update public.quotations set decided_at = '2026-01-01T00:00:00Z' where id = '${id}'`);
    await h.run(MEMBER, "update public.quotations set internal_notes = 'nota' where id = $1", [id]);
    expect(new Date((await row(id)).decided_at as string).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("stores the lost reason only on rejected quotations", async () => {
    const id = await pendingId();
    await h.run(MEMBER, "update public.quotations set status = 'rechazada', lost_reason = 'caro' where id = $1", [id]);
    expect((await row(id)).lost_reason).toBe("caro");
    // reopening or approving silently drops the reason
    await h.run(MEMBER, "update public.quotations set status = 'aprobada' where id = $1", [id]);
    expect((await row(id)).lost_reason).toBeNull();
    await h.run(MEMBER, "update public.quotations set status = 'pendiente', lost_reason = 'caro' where id = $1", [id]);
    expect((await row(id)).lost_reason).toBeNull();
  });

  it("rejects reasons outside the list", async () => {
    const id = await pendingId();
    await h.expectFails(MEMBER, "update public.quotations set status = 'rechazada', lost_reason = 'porque sí' where id = $1", /quotations_lost_reason_check/, [id]);
  });

  it("refreshes updated_at even if the client does not send it", async () => {
    const id = await pendingId();
    await h.db.exec(`update public.quotations set updated_at = '2020-01-01T00:00:00Z' where id = '${id}'`);
    await h.run(MEMBER, "update public.quotations set internal_notes = 'x' where id = $1", [id]);
    expect(new Date((await row(id)).updated_at as string).getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});

describe("editing after creation", () => {
  it("lets active users edit the follow-up fields", async () => {
    const id = await pendingId();
    await h.run(
      MEMBER,
      `update public.quotations set final_price = 4500, internal_notes = 'pidió descuento', channel = 'instagram',
         client_contact = '11-5555-0000', piece_name = 'Soporte', piece_description = 'PETG negro', valid_until = '2026-11-01'
       where id = $1`,
      [id],
    );
    expect(await row(id)).toMatchObject({
      final_price: "4500", internal_notes: "pidió descuento", channel: "instagram", client_contact: "11-5555-0000",
      piece_name: "Soporte", piece_description: "PETG negro",
    });
  });

  it("keeps calculated amounts, the snapshot, the author and decided_at immutable", async () => {
    const id = await pendingId();
    for (const set of ["selling_price = 1", "total_cost = 1", "snapshot = '{}'::jsonb", `user_id = '${MEMBER.sub}'`,
                       "decided_at = now()", "client_name = 'otro'", "quantity = 99"]) {
      await h.expectFails(MEMBER, `update public.quotations set ${set} where id = $1`, /permission denied/, [id]);
    }
  });

  it("still denies deleting and truncating", async () => {
    await h.expectFails(MEMBER, "delete from public.quotations", /permission denied/);
    await h.expectFails(MEMBER, "truncate public.quotations", /permission denied/);
  });

  it("hides quotations and denies edits for pending accounts", async () => {
    await h.access(STRANGER);
    expect(await h.countRows(STRANGER, "quotations")).toBe(0);
    const updated = await h.run(STRANGER, "update public.quotations set internal_notes = 'x' returning id");
    expect(updated).toEqual([]);
  });
});
