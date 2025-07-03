'use server';
/**
 * @fileOverview Flujo de Asistente de Precios con IA.
 *
 * Este archivo define un flujo de Genkit para sugerir un precio razonable para un artículo impreso en 3D
 * basado en su descripción, material y tiempo de impresión.
 *
 * @exports suggestPricing - La función principal para activar el flujo de sugerencia de precios.
 * @exports SuggestPricingInput - El tipo de entrada para la función suggestPricing.
 * @exports SuggestPricingOutput - El tipo de salida para la función suggestPricing.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestPricingInputSchema = z.object({
  productDescription: z.string().describe('Una descripción detallada del producto impreso en 3D.'),
  materialUsed: z.string().describe('El tipo de material usado para la impresión (ej: PLA, ABS, PETG).'),
  printingTime: z.string().describe('El tiempo total de impresión en horas.'),
});

export type SuggestPricingInput = z.infer<typeof SuggestPricingInputSchema>;

const SuggestPricingOutputSchema = z.object({
  suggestedPrice: z.string().describe('Un precio de venta sugerido para el artículo impreso en 3D, en Pesos Argentinos (ARS).'),
  reasoning: z.string().describe('El razonamiento de la IA detrás del precio sugerido.'),
});

export type SuggestPricingOutput = z.infer<typeof SuggestPricingOutputSchema>;

export async function suggestPricing(input: SuggestPricingInput): Promise<SuggestPricingOutput> {
  return suggestPricingFlow(input);
}

const suggestPricingPrompt = ai.definePrompt({
  name: 'suggestPricingPrompt',
  input: {schema: SuggestPricingInputSchema},
  output: {schema: SuggestPricingOutputSchema},
  prompt: `Eres un asistente de precios de IA para productos impresos en 3D.
  Basado en la descripción del producto, el material utilizado y el tiempo de impresión, sugiere un precio de venta razonable en Pesos Argentinos (ARS).
  El precio debe incluir el símbolo de la moneda (ej: $1500 ARS).
  Proporciona una breve explicación de tu razonamiento detrás del precio sugerido.

  Descripción del Producto: {{{productDescription}}}
  Material Usado: {{{materialUsed}}}
  Tiempo de Impresión: {{{printingTime}}}`,
});

const suggestPricingFlow = ai.defineFlow(
  {
    name: 'suggestPricingFlow',
    inputSchema: SuggestPricingInputSchema,
    outputSchema: SuggestPricingOutputSchema,
  },
  async input => {
    const {output} = await suggestPricingPrompt(input);
    return output!;
  }
);
