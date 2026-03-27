'use server';

/**
 * @fileOverview This file implements a Genkit flow for generating AI-powered summaries of sales performance.
 *
 * - generateSalesPerformanceSummary - A function that triggers the AI to analyze sales data and provide insights.
 * - SalesPerformanceSummaryInput - The input type for the summary generation, including sales data and optional filters.
 * - SalesPerformanceSummaryOutput - The return type for the summary generation, containing the summary, trends, top performers, and recommendations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SalesRecordSchema = z.object({
  id_imovel: z.string().describe('Unique identifier for the property.'),
  data_entrada: z.string().describe('Date the property was listed (YYYY-MM-DD format).'),
  data_venda: z.string().describe('Date the property was sold (YYYY-MM-DD format).'),
  origem: z.string().describe('Source of the lead (e.g., Imóvel Web, Zap, Google).'),
  corretor: z.string().describe('Name of the responsible broker.'),
  valor_fechado: z.number().describe('Final sale value of the property.'),
  tempo_de_venda_dias: z.number().describe('Number of days from listing to sale.'),
});

const SalesPerformanceSummaryInputSchema = z.object({
  salesData: z.array(SalesRecordSchema).describe('An array of structured sales records to be analyzed.'),
  startDate: z.string().optional().describe('Optional: Start date for the analysis period (YYYY-MM-DD format).'),
  endDate: z.string().optional().describe('Optional: End date for the analysis period (YYYY-MM-DD format).'),
  brokerName: z.string().optional().describe('Optional: Filter analysis by a specific broker name.'),
});
export type SalesPerformanceSummaryInput = z.infer<typeof SalesPerformanceSummaryInputSchema>;

const SalesPerformanceSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise overview of the sales performance.'),
  keyTrends: z.array(z.string()).describe('An array of significant patterns or shifts identified in the sales data.'),
  topPerformers: z.array(z.string()).describe('An array of names of brokers who performed exceptionally well.'),
  strategicRecommendations: z.array(z.string()).describe('An array of actionable suggestions for improving sales or leveraging strengths.'),
});
export type SalesPerformanceSummaryOutput = z.infer<typeof SalesPerformanceSummaryOutputSchema>;

export async function generateSalesPerformanceSummary(
  input: SalesPerformanceSummaryInput
): Promise<SalesPerformanceSummaryOutput> {
  return salesPerformanceSummaryFlow(input);
}

const salesPerformanceSummaryPrompt = ai.definePrompt({
  name: 'salesPerformanceSummaryPrompt',
  input: { schema: SalesPerformanceSummaryInputSchema },
  output: { schema: SalesPerformanceSummaryOutputSchema },
  prompt: `You are an expert real estate sales performance analyst. Your task is to analyze the provided sales data and generate a concise summary, identify key trends, highlight top performers, and offer strategic recommendations. Respond strictly in the specified JSON format.

**Analysis Context:**
{{#if startDate}}
Sales period start date: {{startDate}}
{{/if}}
{{#if endDate}}
Sales period end date: {{endDate}}
{{/if}}
{{#if brokerName}}
Focusing on broker: {{brokerName}}
{{/if}}

**Sales Data:**
{{#if salesData.length}}
Here is the sales data you need to analyze (JSON format):
{{{JSON.stringify salesData}}}
{{else}}
No sales data was provided for analysis. Please provide a general statement indicating this.
{{/if}}

Please provide your analysis in a structured JSON format as described by the output schema.`,
});

const salesPerformanceSummaryFlow = ai.defineFlow(
  {
    name: 'salesPerformanceSummaryFlow',
    inputSchema: SalesPerformanceSummaryInputSchema,
    outputSchema: SalesPerformanceSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await salesPerformanceSummaryPrompt(input);
    if (!output) {
      throw new Error('Failed to generate sales performance summary.');
    }
    return output;
  }
);
