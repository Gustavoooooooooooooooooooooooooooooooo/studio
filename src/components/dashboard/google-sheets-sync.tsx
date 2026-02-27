
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table2, RefreshCcw, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { collection, serverTimestamp, getDocs, writeBatch } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export function GoogleSheetsSync() {
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  // Função auxiliar para tentar encontrar valores independente da capitalização das colunas
  const getVal = (row: any, keys: string[]) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      const found = rowKeys.find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
      if (found) return row[found];
    }
    return undefined;
  };

  const handleClearData = async () => {
    if (!firestore) return;
    if (!confirm("Isso apagará todos os registros de vendas atuais para que você possa importar dados limpos. Deseja continuar?")) return;

    setClearing(true);
    try {
      const salesCol = collection(firestore, "vendas_imoveis");
      const snapshot = await getDocs(salesCol);
      
      const batch = writeBatch(firestore);
      snapshot.docs.forEach((document) => {
        batch.delete(document.ref);
      });
      
      await batch.commit();

      toast({
        title: "Banco de Dados Limpo",
        description: "Todos os registros antigos foram removidos com sucesso.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao limpar",
        description: "Não foi possível remover os dados antigos.",
      });
    } finally {
      setClearing(false);
    }
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
      
      if (result.success && result.data && result.data.length > 0) {
        const salesCol = collection(firestore, "vendas_imoveis");
        let addedCount = 0;
        
        result.data.forEach((row: any) => {
          // Mapeamento exaustivo em português e inglês
          const propertyId = getVal(row, ["imóvel", "imovel", "id_imovel", "propertyId", "id", "código", "codigo"]);
          const closedValue = getVal(row, ["valor fechado", "valor_fechado", "closedValue", "valor", "preço", "preco"]);
          const advertisedValue = getVal(row, ["valor anúncio", "valor_anuncio", "advertisedValue", "anuncio", "anúncio"]);
          const originChannel = getVal(row, ["canal", "origem", "originChannel", "fonte"]);
          const sellingBrokerId = getVal(row, ["corretor", "sellingBrokerId", "vendedor", "nome"]);
          const saleDate = getVal(row, ["data venda", "data_venda", "saleDate", "data"]);
          const neighborhood = getVal(row, ["bairro", "neighborhood", "região", "regiao"]);
          const listingType = getVal(row, ["tipo", "listingType", "transação", "transacao"]);
          const clientName = getVal(row, ["cliente", "clientName", "nome", "comprador"]);

          if (propertyId || clientName) {
            addDocumentNonBlocking(salesCol, {
              propertyId: String(propertyId || ""),
              clientName: String(clientName || "Cliente Planilha"),
              closedValue: typeof closedValue === 'string' ? Number(closedValue.replace(/[^0-9.-]+/g,"")) : Number(closedValue || 0),
              advertisedValue: typeof advertisedValue === 'string' ? Number(advertisedValue.replace(/[^0-9.-]+/g,"")) : Number(advertisedValue || closedValue || 0),
              originChannel: String(originChannel || "Google Sheets"),
              sellingBrokerId: String(sellingBrokerId || "Não Identificado"),
              saleDate: String(saleDate || new Date().toISOString().split('T')[0]),
              propertyCaptureDate: getVal(row, ["data_entrada", "captureDate", "data entrada"]) || new Date().toISOString().split('T')[0],
              status: "Vendido",
              neighborhood: String(neighborhood || "Desconhecido"),
              listingType: String(listingType || "Venda"),
              importedAt: serverTimestamp(),
            });
            addedCount++;
          }
        });

        toast({
          title: "Sincronização Concluída",
          description: `${addedCount} registros processados da planilha.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sem dados",
          description: result.message || "A planilha parece estar vazia ou o link está incorreto.",
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Table2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Conexão Google Sheets</CardTitle>
              <CardDescription className="text-xs">Sincronize sua planilha externa com o Dashboard</CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearData}
            disabled={clearing}
            className="text-xs text-destructive border-destructive/20 hover:bg-destructive/5"
          >
            {clearing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Trash2 className="h-3 w-3 mr-2" />}
            Limpar Dados Atuais
          </Button>
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
        
        <div className="bg-white/50 p-3 rounded-lg border border-emerald-100 flex items-start gap-3">
          <div className="mt-0.5">
             <AlertCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <p className="font-bold text-emerald-800 mb-1">Como usar seus dados reais:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>No Google Sheets: <b>Arquivo {'>'} Compartilhar {'>'} Publicar na Web</b></li>
              <li>Escolha <b>Valores separados por vírgula (.csv)</b></li>
              <li>Copie o link gerado e cole acima</li>
              <li>Clique em <b>Limpar Dados Atuais</b> se quiser remover os testes antes de importar os reais</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
