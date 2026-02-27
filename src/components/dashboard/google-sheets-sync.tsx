
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
import { collection, serverTimestamp, getDocs, writeBatch, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export function GoogleSheetsSync() {
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  // Função auxiliar para encontrar valores em colunas com nomes variados
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
    if (!confirm("Isso apagará todos os registros de angariação e vendas atuais. Deseja continuar?")) return;

    setClearing(true);
    try {
      const batch = writeBatch(firestore);
      
      const salesCol = await getDocs(collection(firestore, "vendas_imoveis"));
      salesCol.docs.forEach((d) => batch.delete(d.ref));

      const propCol = await getDocs(collection(firestore, "properties"));
      propCol.docs.forEach((d) => batch.delete(d.ref));
      
      await batch.commit();

      toast({
        title: "Banco de Dados Limpo",
        description: "Todos os registros foram removidos com sucesso.",
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
        let addedCount = 0;
        
        result.data.forEach((row: any) => {
          // Mapeamento exaustivo
          const propertyId = String(getVal(row, ["imóvel", "imovel", "id_imovel", "id", "código", "codigo"]) || "");
          const clientName = String(getVal(row, ["cliente", "comprador", "nome"]) || "N/D");
          const closedValue = typeof getVal(row, ["valor fechado", "valor_fechado", "venda", "valor"]) === 'string' 
            ? Number(getVal(row, ["valor fechado", "valor_fechado"])?.replace(/[^0-9.-]+/g,"")) 
            : Number(getVal(row, ["valor fechado", "valor_fechado", "venda", "valor"]) || 0);
          
          const advertisedValue = typeof getVal(row, ["valor anúncio", "valor_anuncio", "anuncio"]) === 'string'
            ? Number(getVal(row, ["valor anúncio", "valor_anuncio"])?.replace(/[^0-9.-]+/g,""))
            : Number(getVal(row, ["valor anúncio", "valor_anuncio", "anuncio"]) || closedValue || 0);

          const broker = String(getVal(row, ["corretor", "vendedor", "angariador", "nome"]) || "Não Identificado");
          const captureDate = getVal(row, ["data entrada", "data_entrada", "angariação", "entrada"]) || new Date().toISOString().split('T')[0];
          const saleDate = getVal(row, ["data venda", "data_venda", "fechamento"]);
          const neighborhood = String(getVal(row, ["bairro", "região", "localidade"]) || "Desconhecido");
          const address = String(getVal(row, ["endereço", "endereco", "logradouro"]) || "Endereço não informado");
          const type = String(getVal(row, ["tipo", "transação", "venda/aluguel"]) || "Venda");
          const origin = String(getVal(row, ["canal", "origem", "fonte"]) || "Google Sheets");

          if (propertyId) {
            // 1. Registrar na coleção de Angariação (Properties)
            const propRef = doc(firestore, "properties", propertyId);
            setDocumentNonBlocking(propRef, {
              propertyCode: propertyId,
              address: address,
              neighborhood: neighborhood,
              listingType: type,
              listingValue: advertisedValue,
              brokerId: broker,
              captureDate: captureDate,
              status: saleDate ? "Vendido" : "Disponível",
              importedAt: serverTimestamp(),
            }, { merge: true });

            // 2. Se tiver data de venda, registrar na coleção de Vendas
            if (saleDate) {
              const saleRef = doc(firestore, "vendas_imoveis", `${propertyId}_sale`);
              setDocumentNonBlocking(saleRef, {
                propertyId: propertyId,
                clientName: clientName,
                closedValue: closedValue,
                advertisedValue: advertisedValue,
                originChannel: origin,
                sellingBrokerId: broker,
                saleDate: saleDate,
                propertyCaptureDate: captureDate,
                neighborhood: neighborhood,
                listingType: type,
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });
            }
            addedCount++;
          }
        });

        toast({
          title: "Sincronização Concluída",
          description: `${addedCount} imóveis processados e atualizados no estoque.`,
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
              <CardTitle className="text-lg">Importação de Angariação (Google Sheets)</CardTitle>
              <CardDescription className="text-xs">Sincronize seu estoque de imóveis via CSV</CardDescription>
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
            Limpar Estoque
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link da Planilha Publicada (CSV)</Label>
          <div className="flex gap-2">
            <Input 
              placeholder="Cole o link do CSV aqui..." 
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
            <p className="font-bold text-emerald-800 mb-1">Dicas para uma sincronização perfeita:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Certifique-se de ter as colunas: <b>Imóvel, Data Entrada, Bairro, Corretor e Valor Anúncio</b>.</li>
              <li>Se o imóvel já foi vendido, inclua a coluna <b>Data Venda</b> para atualizar os gráficos de performance.</li>
              <li>O sistema identifica automaticamente os nomes das colunas, mesmo com acentos ou maiúsculas.</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
