import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_FIELD_LENGTH = 50;
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

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Iniciá sesión para usar el asistente de IA" }, { status: 401 });
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
    const { productDescription, materialUsed, printingTime } = body ?? {};

    if (
      typeof productDescription !== "string" || !productDescription.trim() ||
      typeof materialUsed !== "string" || !materialUsed.trim() ||
      typeof printingTime !== "string" || !printingTime.trim()
    ) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }
    if (
      productDescription.length > MAX_DESCRIPTION_LENGTH ||
      materialUsed.length > MAX_FIELD_LENGTH ||
      printingTime.length > MAX_FIELD_LENGTH
    ) {
      return NextResponse.json(
        { error: "Alguno de los campos supera el largo permitido" },
        { status: 400 }
      );
    }

    const prompt = `Eres un asistente de precios de IA para productos impresos en 3D.
Basado en la descripción del producto, el material utilizado y el tiempo de impresión, sugiere un precio de venta razonable en Pesos Argentinos (ARS).
El precio debe incluir el símbolo de la moneda (ej: $1500 ARS).
Proporciona una breve explicación de tu razonamiento detrás del precio sugerido.

Descripción del Producto: ${productDescription}
Material Usado: ${materialUsed}
Tiempo de Impresión: ${printingTime}

Responde SOLO con un JSON válido con esta estructura exacta (sin markdown, sin backticks):
{"suggestedPrice": "$XXXX ARS", "reasoning": "tu explicación aquí"}`;

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
