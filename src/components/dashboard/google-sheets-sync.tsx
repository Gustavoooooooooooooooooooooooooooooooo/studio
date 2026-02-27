
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table2, RefreshCcw, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";

export function GoogleSheetsSync() {
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    if (!url) {
      toast({
        variant: "destructive",
        title: "URL ausente",
        description: "Por favor, insira a URL CSV da planilha pública.",
      });
      return;
    }

    setSyncing(true);
    try {
      const result = await syncGoogleSheets({ sheetUrl: url });
      
      if (result.success) {
        toast({
          title: "Sincronização Iniciada",
          description: `${result.recordsProcessed} registros detectados na planilha.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro na sincronização",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro fatal",
        description: "Não foi possível conectar ao serviço de sincronização.",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
            <Table2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Conexão Google Sheets</CardTitle>
            <CardDescription className="text-xs">Sincronize sua planilha externa com o Dashboard</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">URL do CSV (Publicado na Web)</Label>
          <div className="flex gap-2">
            <Input 
              placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-white/80"
            />
            <Button 
              onClick={handleSync} 
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 space-y-2">
          <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Instruções de Configuração:
          </h4>
          <ol className="text-[10px] text-emerald-700/80 space-y-1 list-decimal pl-4">
            <li>No Google Sheets, vá em <b>Arquivo</b> &gt; <b>Compartilhar</b> &gt; <b>Publicar na Web</b>.</li>
            <li>Selecione "Valores separados por vírgula (.csv)" em vez de "Página da Web".</li>
            <li>Copie o link gerado e cole acima.</li>
            <li>O app irá mapear os campos: <i>id_imovel, data_venda, corretor, valor_fechado</i>.</li>
          </ol>
        </div>

        <div className="flex items-center justify-between pt-2">
           <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
             <AlertCircle className="h-3 w-3" /> Atualização quase instantânea após publicar.
           </p>
           <Button variant="link" className="text-emerald-600 p-0 h-auto text-[10px] font-bold" asChild>
             <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noopener noreferrer">
               Abrir Planilhas <ExternalLink className="h-2 w-2 ml-1" />
             </a>
           </Button>
        </div>
      </CardContent>
    </Card>
  );
}
