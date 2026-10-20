import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// The route with every network call mocked: Supabase auth + RPC + history, and Gemini.

const body = {
  pieceName: "Llavero dragón", materialUsed: "PLA", weightGrams: 40, printTimeHours: 1.5, quantity: 20, channel: "instagram",
  strategy: "balanced", costPerUnit: 2350, currentPricePerUnit: 9400, multiplier: 4,
};

const history = [
  { piece_name: "Llavero dragón articulado", material_used: "PLA", quantity: 20, print_weight_grams: 40, print_time_hours: 1, print_time_minutes: 30, final_price: 52000, selling_price: 56000, status: "aprobada", lost_reason: null, channel: "instagram" },
  { piece_name: "Llavero mini", material_used: "PLA", quantity: 1, print_weight_grams: 40, print_time_hours: 1, print_time_minutes: 30, final_price: 9000, selling_price: 9000, status: "rechazada", lost_reason: "caro", channel: "directo" },
];

const modelAnswer = { minimo: 3000, recomendado: 4207, premium: 5600, razones: ["Cubre tu costo con margen", "Se aprobó a $2.600 antes", "Rechazaron $9.000 por caro"], alerta: null };

type Mocks = { user?: string | null; active?: boolean; rows?: unknown; historyStatus?: number; gemini?: Array<{ status: number; json?: unknown; text?: string }> };

let calls: { url: string; init?: RequestInit }[] = [];

function mockNetwork(m: Mocks = {}) {
  const gemini = [...(m.gemini ?? [{ status: 200, json: modelAnswer }])];
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const respond = (status: number, data: unknown) => new Response(typeof data === "string" ? data : JSON.stringify(data), { status });
    if (url.includes("/auth/v1/user")) return m.user === null ? respond(401, {}) : respond(200, { id: m.user ?? "user-default" });
    if (url.includes("/rest/v1/rpc/is_active_user")) return respond(200, m.active ?? true);
    if (url.includes("/rest/v1/quotations")) return respond(m.historyStatus ?? 200, m.rows ?? history);
    if (url.includes("generativelanguage.googleapis.com")) {
      const next = gemini.shift() ?? { status: 500, text: "no more mocks" };
      if (next.text !== undefined) return respond(next.status, next.text);
      return respond(next.status, { candidates: [{ content: { parts: [{ text: JSON.stringify(next.json) }] } }] });
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
}

const post = (payload: unknown = body, token: string | null = "token") =>
  POST(new NextRequest("http://localhost/api/suggest-pricing", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  }));

const geminiCalls = () => calls.filter((c) => c.url.includes("generativelanguage"));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.GOOGLE_GENAI_API_KEY = "gemini-key";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("access control", () => {
  it("answers 401 without a session, with an invalid session or without any token", async () => {
    mockNetwork();
    expect((await post(body, null)).status).toBe(401);
    mockNetwork({ user: null });
    expect((await post()).status).toBe(401);
  });

  it("answers 403 to accounts an administrator has not approved, without calling the model", async () => {
    mockNetwork({ active: false, user: "pending-user" });
    const res = await post();
    expect(res.status).toBe(403);
    expect(geminiCalls()).toHaveLength(0);
  });

  it("rate limits a user after 10 requests per minute", async () => {
    mockNetwork({ user: "rate-user", gemini: Array.from({ length: 11 }, () => ({ status: 200, json: modelAnswer })) });
    for (let i = 0; i < 10; i++) expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(429);
  });

  it("answers 500 when the model key is not configured", async () => {
    mockNetwork({ user: "nokey-user" });
    delete process.env.GOOGLE_GENAI_API_KEY;
    expect((await post()).status).toBe(500);
  });
});

describe("validation", () => {
  it("answers 400 with a useful message when the piece name is missing, and 400 for malformed bodies", async () => {
    mockNetwork({ user: "val-user-1" });
    const res = await post({ ...body, pieceName: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/qué pieza es/);
    expect((await post("not json")).status).toBe(400);
    expect(geminiCalls()).toHaveLength(0);
  });
});

describe("a successful suggestion", () => {
  it("returns the normalized range, the reasons and how many similar quotations were used", async () => {
    mockNetwork({ user: "ok-user-1" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ minimo: 3000, recomendado: 4210, premium: 5600, razones: modelAnswer.razones, alerta: null, similarCount: 2 });
  });

  it("raises prices under the cost to the cost and warns", async () => {
    mockNetwork({ user: "ok-user-2", gemini: [{ status: 200, json: { ...modelAnswer, minimo: 900, recomendado: 1500, premium: 4000 } }] });
    const json = await (await post()).json();
    expect([json.minimo, json.recomendado]).toEqual([2350, 2350]);
    expect(json.alerta).toMatch(/por debajo del costo/);
  });

  it("asks the model for structured JSON with the real cost, the strategy and the similar quotations", async () => {
    mockNetwork({ user: "ok-user-3" });
    await post({ ...body, strategy: "competitive" });
    const [call] = geminiCalls();
    expect(call.init?.headers).toMatchObject({ "x-goog-api-key": "gemini-key" });
    expect(call.url).not.toContain("key="); // the key travels in a header, never in the URL
    const sent = JSON.parse(String(call.init?.body));
    expect(sent.generationConfig).toMatchObject({ responseMimeType: "application/json" });
    expect(sent.generationConfig.responseSchema.required).toEqual(["minimo", "recomendado", "premium", "razones"]);
    const prompt: string = sent.contents[0].parts[0].text;
    expect(prompt).toMatch(/Costo de producción: \$\s?2\.350/);
    expect(prompt).toContain("cerca del mínimo aceptable");
    expect(prompt).toMatch(/\$\s?2\.600 por unidad, aprobada/);
    expect(prompt).toMatch(/rechazada por: Caro/);
  });

  it("reads the history with the caller's token and without client names", async () => {
    mockNetwork({ user: "ok-user-4" });
    await post();
    const historyCall = calls.find((c) => c.url.includes("/rest/v1/quotations"))!;
    expect(historyCall.init?.headers).toMatchObject({ Authorization: "Bearer token", apikey: "anon" });
    expect(historyCall.url).toContain("status=in.(aprobada,rechazada)");
    expect(historyCall.url).not.toMatch(/client_name|client_contact|user_name|user_email/);
  });

  it("still answers when the history cannot be read, just without similar quotations", async () => {
    mockNetwork({ user: "ok-user-5", historyStatus: 500 });
    const json = await (await post()).json();
    expect(json.similarCount).toBe(0);
    expect(json.recomendado).toBe(4210);
  });
});

describe("model failures", () => {
  it("falls back to the next model when one fails", async () => {
    mockNetwork({ user: "fail-user-1", gemini: [{ status: 503, text: "overloaded" }, { status: 200, json: modelAnswer }] });
    expect((await post()).status).toBe(200);
    expect(geminiCalls()).toHaveLength(2);
    expect(geminiCalls()[1].url).toContain("gemini-2.0-flash:");
  });

  it("falls back when a model answers with the wrong shape", async () => {
    mockNetwork({ user: "fail-user-2", gemini: [{ status: 200, json: { precio: "mucho" } }, { status: 200, text: "not json" }, { status: 200, json: modelAnswer }] });
    expect((await post()).status).toBe(200);
    expect(geminiCalls()).toHaveLength(3);
  });

  it("answers 502 with a friendly message, never the provider's raw error, when every model fails", async () => {
    mockNetwork({ user: "fail-user-3", gemini: [{ status: 500, text: "SECRET INTERNAL DETAIL" }, { status: 500, text: "x" }, { status: 500, text: "y" }] });
    const res = await post();
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toMatch(/No se pudo obtener una respuesta/);
    expect(text).not.toContain("SECRET");
  });
});
