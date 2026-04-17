import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key no configurada" },
      { status: 500 }
    );
  }

  const { productDescription, materialUsed, printingTime } = await req.json();

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google AI API error:", errorText);
    return NextResponse.json(
      { error: "Error al consultar la IA" },
      { status: 502 }
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return NextResponse.json(
      { error: "Respuesta vacía de la IA" },
      { status: 502 }
    );
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
