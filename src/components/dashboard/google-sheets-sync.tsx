
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table2, RefreshCcw, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export function GoogleSheetsSync() {
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  // Função auxiliar para tentar encontrar valores independente da capitalização das colunas
  const getVal = (row: any, keys: string[]) => {
    for (const key of keys) {
      const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase());
      if (found) return row[found];
    }
    return undefined;
  };

  const handleSync = async () => {
    if (!url) {
      toast({
        variant: "destructive",
        title: "URL ausente",
        description: "Por favor, insira a URL CSV da planilha pública.",
      });
      return;
    }

    if (!firestore) return;

    setSyncing(true);
    try {
      const result = await syncGoogleSheets({ sheetUrl: url });
      
      if (result.success && result.data) {
        const salesCol = collection(firestore, "vendas_imoveis");
        
        result.data.forEach((row: any) => {
          // Busca campos de forma flexível para aceitar variações de nomes de colunas
          const propertyId = getVal(row, ["id_imovel", "propertyId", "imovel_id", "id"]);
          const closedValue = getVal(row, ["valor_fechado", "closedValue", "valor", "preco"]);
          const advertisedValue = getVal(row, ["valor_anuncio", "advertisedValue", "valor_original"]);
          const originChannel = getVal(row, ["origem", "originChannel", "canal"]);
          const sellingBrokerId = getVal(row, ["corretor", "sellingBrokerId", "nome_corretor"]);
          const saleDate = getVal(row, ["data_venda", "saleDate", "data"]);
          const neighborhood = getVal(row, ["bairro", "neighborhood"]);
          const listingType = getVal(row, ["tipo", "listingType", "transacao"]);
          const clientName = getVal(row, ["cliente", "clientName", "nome_cliente"]);

          if (propertyId) {
            addDocumentNonBlocking(salesCol, {
              propertyId: String(propertyId),
              clientName: clientName || "Importado",
              closedValue: Number(closedValue || 0),
              advertisedValue: Number(advertisedValue || closedValue || 0),
              originChannel: originChannel || "Sincronização",
              sellingBrokerId: sellingBrokerId || "Não Atribuído",
              saleDate: saleDate || new Date().toISOString().split('T')[0],
              propertyCaptureDate: getVal(row, ["data_entrada", "captureDate"]) || new Date().toISOString().split('T')[0],
              status: "Vendido",
              neighborhood: neighborhood || "Desconhecido",
              listingType: listingType || "Venda",
              importedAt: serverTimestamp(),
            });
          }
        });

        toast({
          title: "Sincronização Concluída",
          description: `${result.recordsProcessed} registros processados e enviados para o banco de dados.`,
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
              placeholder="Cole o link aqui..." 
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
        {/* ... restante do componente ... */}
      </CardContent>
    </Card>
  );
}
