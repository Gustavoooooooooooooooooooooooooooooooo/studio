
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
      let finalUrl = input.sheetUrl;

      // Tenta converter links de edição comuns para links de exportação CSV
      if (finalUrl.includes('/edit')) {
        const baseUrl = finalUrl.split('/edit')[0];
        const gidMatch = finalUrl.match(/gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : '0';
        finalUrl = `${baseUrl}/export?format=csv&gid=${gid}`;
      }

      // Adiciona cache-busting para evitar que o Google Sheets entregue dados antigos
      const cacheBuster = `&t=${Date.now()}`;
      const urlWithNoCache = finalUrl.includes('?') ? `${finalUrl}${cacheBuster}` : `${finalUrl}?${cacheBuster}`;

      const response = await fetch(urlWithNoCache, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao acessar planilha: ${response.statusText}`);
      }
      
      const csvText = await response.text();
      
      if (csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes('<html')) {
        throw new Error('O link fornecido não aponta para um CSV público. Publique na Web como CSV.');
      }

      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      if (parsed.errors.length > 0) {
        return {
          success: false,
          recordsProcessed: 0,
          message: 'Erro ao processar o conteúdo do CSV.',
          errors: parsed.errors.map(e => e.message),
        };
      }

      return {
        success: true,
        recordsProcessed: parsed.data.length,
        message: 'Dados processados com sucesso.',
        data: parsed.data,
      };
    } catch (error: any) {
      return {
        success: false,
        recordsProcessed: 0,
        message: error.message || 'Erro inesperado na sincronização.',
      };
    }
  }
);
