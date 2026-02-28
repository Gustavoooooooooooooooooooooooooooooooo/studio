
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table2, RefreshCcw, AlertCircle, Loader2, Trash2, CheckCircle2 } from "lucide-react";
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
    
    // Normaliza todas as chaves da linha para comparação
    const normalizedRowKeys = rowKeys.map(k => 
      k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim()
    );

    for (const key of keys) {
      const normalizedSearchKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
      
      const foundIndex = normalizedRowKeys.findIndex(k => 
        k === normalizedSearchKey || k.includes(normalizedSearchKey) || normalizedSearchKey.includes(k)
      );

      if (foundIndex !== -1) {
        const actualKey = rowKeys[foundIndex];
        const val = row[actualKey];
        if (val !== undefined && val !== null && String(val).trim() !== "") return val;
      }
    }
    return undefined;
  };

  // Conversor de data robusto
  const parseDate = (val: any) => {
    if (!val) return null;
    const s = String(val).trim();
    if (s === "" || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return null;
    
    // Tenta formato DD/MM/YYYY
    const brDateMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (brDateMatch) {
      const day = parseInt(brDateMatch[1]);
      const month = parseInt(brDateMatch[2]) - 1;
      let year = parseInt(brDateMatch[3]);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  };

  // Conversor de moeda robusto
  const parseCurrency = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    let s = String(val).trim();
    
    // Remove R$, espaços e caracteres não numéricos, mantendo vírgula e ponto
    s = s.replace(/[^0-9,.]/g, "");

    if (s.includes('.') && s.includes(',')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (s.includes(',')) {
      s = s.replace(",", ".");
    }
    
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  const handleClearData = async () => {
    if (!firestore) return;
    if (!confirm("Isso apagará todos os registros atuais para garantir uma sincronização limpa. Continuar?")) return;

    setClearing(true);
    try {
      const collectionsToClear = ["vendas_imoveis", "properties", "leads", "visits"];
      for (const colName of collectionsToClear) {
        const snapshot = await getDocs(collection(firestore, colName));
        const batch = writeBatch(firestore);
        snapshot.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      toast({ title: "Base Limpa", description: "O sistema está pronto para receber novos dados reais." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao limpar", description: error.message });
    } finally {
      setClearing(false);
    }
  };

  const handleSync = async () => {
    if (!url) {
      toast({ variant: "destructive", title: "Link ausente", description: "Insira o link de publicação CSV da sua planilha." });
      return;
    }
    if (!firestore) return;

    setSyncing(true);
    try {
      const result = await syncGoogleSheets({ sheetUrl: url });
      
      if (result.success && result.data && result.data.length > 0) {
        let addedCount = 0;
        
        for (const row of result.data) {
          // 1. Identificação do Imóvel (Crucial)
          const propertyId = String(getVal(row, ["imovel", "codigo", "ref", "id", "unidade", "identificador", "p", "venda", "locacao"]) || "");
          if (!propertyId || propertyId === "" || propertyId === "undefined") continue;

          // 2. Tipo (Venda ou Locação)
          let typeStr = String(getVal(row, ["tipo", "transacao", "categoria", "operacao", "negocio", "finalidade"]) || "");
          const isLocacao = typeStr.toLowerCase().includes("loc") || typeStr.toLowerCase().includes("alug") || typeStr.toLowerCase().includes("rent");
          const type = isLocacao ? "Locação" : "Venda";

          // 3. Valores Financeiros
          const advertisedValue = parseCurrency(getVal(row, ["valor anuncio", "valor imovel", "valor venda", "valor locacao", "preco", "pedida", "anuncio", "valor"]));
          const closedValue = parseCurrency(getVal(row, ["valor fechado", "valor fechamento", "fechado", "venda final", "venda real", "preco fechado"]));

          // 4. Detalhes
          const broker = String(getVal(row, ["corretor", "vendedor", "angariador", "responsavel", "consultor", "corretora"]) || "Não Identificado");
          const neighborhood = String(getVal(row, ["bairro", "regiao", "localidade", "zona", "distrito", "setor"]) || "Desconhecido");
          const address = String(getVal(row, ["endereco", "logradouro", "rua", "avenida", "local"]) || "Endereço não informado");
          
          const captureDateStr = getVal(row, ["data entrada", "angariacao", "entrada", "data", "lancamento", "captacao", "inicio"]);
          const captureDate = parseDate(captureDateStr) || new Date().toISOString().split('T')[0];
          
          const saleDateStr = getVal(row, ["data venda", "fechamento", "venda em", "vendido", "data fechado", "venda data"]);
          const saleDate = parseDate(saleDateStr);

          // REGISTRO 1: Gestão de Angariação (Estoque)
          const propRef = doc(firestore, "properties", propertyId);
          setDocumentNonBlocking(propRef, {
            propertyCode: propertyId,
            address,
            neighborhood,
            listingType: type,
            listingValue: advertisedValue,
            brokerId: broker,
            captureDate,
            status: saleDate ? "Vendido" : "Disponível",
            importedAt: serverTimestamp(),
          }, { merge: true });

          // REGISTRO 2: Conclusão de Venda (Se houver data de venda)
          if (saleDate) {
            const saleRef = doc(firestore, "vendas_imoveis", `${propertyId}_sale`);
            setDocumentNonBlocking(saleRef, {
              propertyId,
              clientName: String(getVal(row, ["cliente", "comprador", "locatario", "comprado por", "fechado com"]) || "Cliente"),
              closedValue: closedValue || advertisedValue,
              advertisedValue: advertisedValue,
              originChannel: String(getVal(row, ["canal", "origem", "fonte", "meio", "marketing"]) || "Google Sheets"),
              sellingBrokerId: broker,
              saleDate,
              propertyCaptureDate: captureDate,
              neighborhood,
              listingType: type,
              status: "Vendido",
              importedAt: serverTimestamp(),
            }, { merge: true });
          }
          addedCount++;
        }

        toast({
          title: "Sucesso!",
          description: `${addedCount} registros foram sincronizados. Verifique o Dashboard!`,
        });
      } else {
        throw new Error(result.message || "Nenhum dado encontrado na planilha.");
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Erro de Sincronização", 
        description: error.message || "Certifique-se que o link CSV está correto e público." 
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
              <RefreshCcw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Sincronização de Dados Reais</CardTitle>
              <CardDescription className="text-xs">Puxe seu estoque e fechamentos direto do Google Sheets</CardDescription>
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
            Limpar Base Atual
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link da Planilha (Publicado como CSV)</Label>
          <div className="flex gap-2">
            <Input 
              placeholder="Cole o link .csv gerado pelo Google aqui..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-white/80"
            />
            <Button 
              onClick={handleSync} 
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar Agora"}
            </Button>
          </div>
        </div>
        
        <div className="bg-white/50 p-3 rounded-lg border border-emerald-100 flex items-start gap-3">
          <div className="mt-0.5">
             <AlertCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <p className="font-bold text-emerald-800 mb-1">Como garantir que funcione:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>No Google Sheets: <b>Arquivo {'>'} Compartilhar {'>'} Publicar na Web</b>.</li>
              <li>Selecione <b>Valores separados por vírgula (.csv)</b> e copie o link.</li>
              <li>Novos imóveis adicionados na planilha podem demorar até 5 minutos para o Google atualizar o link público.</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
