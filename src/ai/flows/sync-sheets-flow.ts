'use server';

import { z } from 'zod';
import Papa from 'papaparse';

const SyncSheetsInputSchema = z.object({
  sheetUrl: z.string().url(),
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
  try {
    let finalUrl = input.sheetUrl;

    if (finalUrl.includes('/edit') || finalUrl.includes('/view')) {
      const baseUrl = finalUrl.split('/edit')[0].split('/view')[0];
      const gidMatch = finalUrl.match(/gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      finalUrl = `${baseUrl}/export?format=csv&gid=${gid}`;
    }

    const cacheBuster = `t=${Date.now()}`;
    const urlWithNoCache = finalUrl.includes('?')
      ? `${finalUrl}&${cacheBuster}`
      : `${finalUrl}?${cacheBuster}`;

    const response = await fetch(urlWithNoCache, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao acessar planilha: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

    if (csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes('<html')) {
      throw new Error('O link não aponta para um CSV público. No Google Sheets, vá em Arquivo > Compartilhar > Publicar na Web e escolha o formato CSV.');
    }

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        message: 'Erro ao processar o conteúdo do CSV.',
        errors: parsed.errors.map((e) => e.message),
      };
    }

    return {
      success: true,
      recordsProcessed: parsed.data.length,
      message: 'Dados lidos com sucesso.',
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