import { NextRequest, NextResponse } from "next/server";
import { buildPricingPrompt, parsePricingRequest } from "@/lib/pricing-prompt";

export const runtime = "edge";

const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

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

// Validates the Supabase session token sent by the browser and returns the user id (null if invalid).
async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !token) return null;

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return typeof user?.id === "string" ? user.id : null;
}

// Asks the database whether the caller's account was approved by an administrator (RPC runs with the caller's token).
async function isActiveUser(req: NextRequest): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !token) return false;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/is_active_user`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return false;
  return (await res.json().catch(() => null)) === true;
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
      return NextResponse.json(
        { error: "API key no configurada" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = parsePricingRequest(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const prompt = buildPricingPrompt(parsed.data);

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
    let lastError = "";

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        lastError = await response.text();
        console.error(`Google AI API error (${model}):`, lastError);
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        lastError = "Empty response from AI";
        console.error(`Empty response from ${model}`);
        continue;
      }

      try {
        const parsed = JSON.parse(text);
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json(
          { suggestedPrice: "N/A", reasoning: text },
        );
      }
    }

    return NextResponse.json(
      { error: "No se pudo obtener una respuesta de la IA. Intentá de nuevo en unos minutos." },
      { status: 502 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Suggest pricing route error:", message);
    return NextResponse.json(
      { error: "Error interno al consultar la IA" },
      { status: 500 }
    );
  }
}
