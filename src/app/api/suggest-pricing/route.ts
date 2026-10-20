import { NextRequest, NextResponse } from "next/server";
import {
  DECIDED_COLUMNS, SUGGESTION_RESPONSE_SCHEMA, buildPricingPrompt, normalizeSuggestion, parsePricingRequest, selectSimilar,
  suggestionSchema, type DecidedRow, type PricingResponse,
} from "@/lib/pricing-prompt";

export const runtime = "edge";

const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const HISTORY_LIMIT = 100;
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

// Best-effort limiter: state lives in each edge instance, so it caps bursts but is not a global quota.
const requestLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(userId, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(userId, recent);
  if (requestLog.size > 1000) {
    for (const [id, times] of requestLog) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) requestLog.delete(id);
    }
  }
  return false;
}

function supabaseAccess(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return null;
  return { url, headers: { apikey: anonKey, Authorization: `Bearer ${token}` } };
}

// Validates the Supabase session token sent by the browser and returns the user id (null if invalid).
async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const access = supabaseAccess(req);
  if (!access) return null;
  const res = await fetch(`${access.url}/auth/v1/user`, { headers: access.headers });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return typeof user?.id === "string" ? user.id : null;
}

// Asks the database whether the caller's account was approved by an administrator (RPC runs with the caller's token).
async function isActiveUser(req: NextRequest): Promise<boolean> {
  const access = supabaseAccess(req);
  if (!access) return false;
  const res = await fetch(`${access.url}/rest/v1/rpc/is_active_user`, {
    method: "POST",
    headers: { ...access.headers, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return false;
  return (await res.json().catch(() => null)) === true;
}

/** The shop's closed quotations, read with the caller's own permissions. Failing here only means "no history". */
async function loadDecidedRows(req: NextRequest): Promise<DecidedRow[]> {
  const access = supabaseAccess(req);
  if (!access) return [];
  try {
    const res = await fetch(
      `${access.url}/rest/v1/quotations?select=${DECIDED_COLUMNS}&status=in.(aprobada,rechazada)&order=created_at.desc&limit=${HISTORY_LIMIT}`,
      { headers: access.headers },
    );
    if (!res.ok) return [];
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? (rows as DecidedRow[]) : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Iniciá sesión para usar el asistente de IA" }, { status: 401 });
    }
    if (!(await isActiveUser(req))) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene acceso a la herramienta. Pedile acceso a un administrador." },
        { status: 403 }
      );
    }
    if (isRateLimited(userId)) {
      return NextResponse.json(
        { error: "Demasiadas consultas. Esperá un minuto e intentá de nuevo." },
        { status: 429 }
      );
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_GENAI_API_KEY is not set");
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const parsed = parsePricingRequest(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const request = parsed.data;

    const similar = selectSimilar(await loadDecidedRows(req), {
      pieceName: request.pieceName,
      materialUsed: request.materialUsed,
      weightGrams: request.weightGrams,
      printTimeHours: request.printTimeHours,
    });
    const prompt = buildPricingPrompt(request, similar);

    let lastError = "";
    for (const model of MODELS) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SUGGESTION_RESPONSE_SCHEMA,
            temperature: 0.4,
          },
        }),
      });

      if (!response.ok) {
        lastError = await response.text();
        console.error(`Google AI API error (${model}):`, lastError);
        continue;
      }

      const data = await response.json().catch(() => null);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      let json: unknown = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* handled below */ }
      const suggestion = suggestionSchema.safeParse(json);
      if (!suggestion.success) {
        lastError = "Respuesta de la IA fuera de formato";
        console.error(`Unusable answer from ${model}`);
        continue;
      }

      const result: PricingResponse = {
        ...normalizeSuggestion(suggestion.data, request.costPerUnit),
        similarCount: similar.length,
      };
      return NextResponse.json(result);
    }

    console.error("All models failed:", lastError.substring(0, 200));
    return NextResponse.json(
      { error: "No se pudo obtener una respuesta de la IA. Intentá de nuevo en unos minutos." },
      { status: 502 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Suggest pricing route error:", message);
    return NextResponse.json({ error: "Error interno al consultar la IA" }, { status: 500 });
  }
}
