'use server';
/**
 * @fileOverview Genkit flow to sync Google Sheets CSV data to Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import Papa from 'papaparse';

const SyncSheetsInputSchema = z.object({
  sheetUrl: z.string().url().describe('The public CSV export URL of the Google Sheet.'),
});
export type SyncSheetsInput = z.infer<typeof SyncSheetsInputSchema>;

const SyncSheetsOutputSchema = z.object({
  success: z.boolean(),
  recordsProcessed: z.number(),
  message: z.string(),
  data: z.array(z.any()).optional(),
  errors: z.array(z.string()).optional(),
});
export type SyncSheetsOutput = z.infer<typeof SyncSheetsOutputSchema>;

export async function syncGoogleSheets(input: SyncSheetsInput): Promise<SyncSheetsOutput> {
  return syncSheetsFlow(input);
}

const syncSheetsFlow = ai.defineFlow(
  {
    name: 'syncSheetsFlow',
    inputSchema: SyncSheetsInputSchema,
    outputSchema: SyncSheetsOutputSchema,
  },
  async (input) => {
    try {
      const response = await fetch(input.sheetUrl);
      if (!response.ok) throw new Error('Failed to fetch CSV from URL.');
      
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      if (parsed.errors.length > 0) {
        return {
          success: false,
          recordsProcessed: 0,
          message: 'Error parsing CSV data.',
          errors: parsed.errors.map(e => e.message),
        };
      }

      return {
        success: true,
        recordsProcessed: parsed.data.length,
        message: 'Data fetched successfully. Persisting to database...',
        data: parsed.data,
      };
    } catch (error: any) {
      return {
        success: false,
        recordsProcessed: 0,
        message: error.message || 'An unexpected error occurred during sync.',
      };
    }
  }
);