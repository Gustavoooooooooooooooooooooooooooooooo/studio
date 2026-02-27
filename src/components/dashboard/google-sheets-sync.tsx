
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

  // Função auxiliar para encontrar valores em colunas com nomes variados (Fuzzy matching)
  const getVal = (row: any, keys: string[]) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    // Tenta correspondência exata ou aproximada (ignorando acentos e espaços)
    for (const key of keys) {
      const found = rowKeys.find(k => {
        const normalizedK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return normalizedK === normalizedKey || normalizedK.includes(normalizedKey);
      });
      if (found && row[found] !== undefined && row[found] !== null && row[found] !== "") return row[found];
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
          // 1. Identificação do Imóvel
          const propertyId = String(getVal(row, ["imovel", "id", "codigo", "ref", "unidade"]) || "");
          if (!propertyId) return;

          // 2. Identificação do Tipo (Venda ou Locação)
          let type = String(getVal(row, ["tipo", "transacao", "venda/aluguel", "categoria"]) || "Venda");
          if (type.toLowerCase().includes("loc") || type.toLowerCase().includes("alug")) {
            type = "Locação";
          } else {
            type = "Venda";
          }

          // 3. Captura de Valores Financeiros (Mapeamento Robusto)
          const parseCurrency = (val: any) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
              // Remove símbolos de moeda, pontos de milhar e troca vírgula por ponto
              const cleaned = val.replace(/[^0-9,.-]+/g,"").replace(/\./g, "").replace(",", ".");
              const num = parseFloat(cleaned);
              return isNaN(num) ? 0 : num;
            }
            return 0;
          };

          // Tenta buscar o valor de anúncio em várias colunas possíveis, inclusive específicas de venda/locação
          const advertisedValue = parseCurrency(getVal(row, [
            "valor anuncio", "valor de anuncio", "valor do imovel", 
            "valor venda", "valor locacao", "valor aluguel", 
            "preço", "pedida", "valor"
          ]));

          const closedValue = parseCurrency(getVal(row, ["valor fechado", "valor de fechamento", "valor venda", "valor locacao"])) || advertisedValue;

          // 4. Outros Dados
          const broker = String(getVal(row, ["corretor", "vendedor", "angariador", "responsavel"]) || "Não Identificado");
          const captureDate = getVal(row, ["data entrada", "angariacao", "entrada", "data"]) || new Date().toISOString().split('T')[0];
          const saleDate = getVal(row, ["data venda", "fechamento", "data fechamento", "data de venda"]);
          const neighborhood = String(getVal(row, ["bairro", "regiao", "localidade", "distrito"]) || "Desconhecido");
          const address = String(getVal(row, ["endereco", "logradouro", "rua"]) || "Endereço não informado");
          const clientName = String(getVal(row, ["cliente", "comprador", "locatario"]) || "Cliente");
          const origin = String(getVal(row, ["canal", "origem", "fonte"]) || "Google Sheets");

          // Salvar na coleção de Angariação (Estoque)
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

          // Se tiver data de venda, registrar na coleção de Vendas para o Dashboard
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
        });

        toast({
          title: "Sincronização Concluída",
          description: `${addedCount} imóveis sincronizados com sucesso.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Nenhum dado encontrado",
          description: "Certifique-se de que a planilha está publicada como CSV e contém dados.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na sincronização",
        description: "Não foi possível ler os dados. Verifique se o link está correto.",
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
              <CardTitle className="text-lg">Sincronização Google Sheets</CardTitle>
              <CardDescription className="text-xs">Importe seu estoque de Vendas e Locações</CardDescription>
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
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">URL da Planilha Publicada (CSV)</Label>
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
            <p className="font-bold text-emerald-800 mb-1">Como garantir que todos os valores apareçam:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>O sistema busca colunas chamadas: <b>Valor Anúncio, Valor Venda, Valor Locação ou Valor do Imóvel</b>.</li>
              <li>Se você tem abas diferentes (Vendas e Locação), sincronize o link de cada uma separadamente.</li>
              <li>Certifique-se de <b>Arquivo {'>'} Compartilhar {'>'} Publicar na Web</b> como <b>CSV</b>.</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
