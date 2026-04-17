import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_GENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "API key no configurada" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { productDescription, materialUsed, printingTime } = body;

    if (!productDescription || !materialUsed || !printingTime) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
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

    const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
    let lastError = "";

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      { error: `Error al consultar la IA: ${lastError.substring(0, 200)}` },
      { status: 502 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Suggest pricing route error:", message);
    return NextResponse.json(
      { error: `Error interno: ${message}` },
      { status: 500 }
    );
  }
}
