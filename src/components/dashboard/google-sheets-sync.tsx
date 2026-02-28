
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCcw, AlertCircle, Loader2, Trash2 } from "lucide-react";
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

  // Helper para normalizar strings e comparar chaves
  const normalize = (s: string) => 
    String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();

  // Função auxiliar para encontrar valores em colunas com nomes variados
  const getVal = (row: any, keys: string[]) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedSearchKeys = keys.map(normalize);

    for (const rowKey of rowKeys) {
      const normalizedRowKey = normalize(rowKey);
      if (normalizedSearchKeys.some(sk => normalizedRowKey === sk || normalizedRowKey.includes(sk) || sk.includes(normalizedRowKey))) {
        const val = row[rowKey];
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
    
    const brDateMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (brDateMatch) {
      const day = parseInt(brDateMatch[1]);
      const month = parseInt(brDateMatch[2]) - 1;
      let year = parseInt(brDateMatch[3]);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    }
    
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  };

  // Conversor de moeda robusto
  const parseCurrency = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    let s = String(val).trim();
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
    if (!confirm("Isso apagará todos os registros para uma nova sincronização limpa. Continuar?")) return;

    setClearing(true);
    try {
      const collectionsToClear = ["vendas_imoveis", "properties"];
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
      toast({ variant: "destructive", title: "Link ausente", description: "Insira o link CSV da sua planilha." });
      return;
    }
    if (!firestore) return;

    setSyncing(true);
    try {
      const result = await syncGoogleSheets({ sheetUrl: url });
      
      if (result.success && result.data && result.data.length > 0) {
        let addedCount = 0;
        let salesFound = 0;
        
        for (const row of result.data) {
          try {
            // 1. Identificação - Melhorada para não pegar valores financeiros
            const rawId = getVal(row, ["imovel", "codigo", "ref", "unidade", "identificador", "p id"]);
            const propertyId = String(rawId || "").trim();
            if (!propertyId || propertyId === "" || propertyId === "undefined") continue;

            // Sanetização do ID para o Firestore (evita erro de barras)
            const safePropertyId = propertyId.replace(/\//g, "-").replace(/\\/g, "-");

            // 2. Tipo
            let typeStr = String(getVal(row, ["tipo", "transacao", "categoria", "operacao", "negocio", "finalidade", "contrato"]) || "");
            const isLocacao = typeStr.toLowerCase().includes("loc") || typeStr.toLowerCase().includes("alug") || typeStr.toLowerCase().includes("rent");
            const type = isLocacao ? "Locação" : "Venda";

            // 3. Valores
            const advertisedValue = parseCurrency(getVal(row, ["valor anuncio", "valor imovel", "valor venda", "valor locacao", "preco", "pedida", "anuncio", "valor", "venda", "locacao"]));
            const closedValue = parseCurrency(getVal(row, ["valor fechado", "valor fechamento", "fechado", "venda final", "venda real", "venda_real"]));

            // 4. Detalhes
            const broker = String(getVal(row, ["corretor", "vendedor", "angariador", "responsavel", "consultor", "corretora", "captador"]) || "Não Identificado");
            const neighborhood = String(getVal(row, ["bairro", "regiao", "localidade", "zona", "distrito", "setor"]) || "Desconhecido");
            const address = String(getVal(row, ["endereco", "logradouro", "rua", "avenida", "local"]) || "Endereço não informado");
            
            const captureDateStr = getVal(row, ["data entrada", "angariacao", "entrada", "data", "lancamento", "captacao", "inicio", "data_entrada"]);
            const captureDate = parseDate(captureDateStr) || new Date().toISOString().split('T')[0];
            
            const saleDateStr = getVal(row, ["data venda", "fechamento", "venda em", "vendido", "data fechado", "venda data", "venda_em", "data_venda", "data"]);
            const saleDate = parseDate(saleDateStr);

            // REGISTRO 1: Angariação (Propriedades)
            const propRef = doc(firestore, "properties", safePropertyId);
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

            // REGISTRO 2: Venda (Se houver data de venda)
            if (saleDate) {
              const saleRef = doc(firestore, "vendas_imoveis", `${safePropertyId}_sale`);
              setDocumentNonBlocking(saleRef, {
                propertyId,
                clientName: String(getVal(row, ["cliente", "comprador", "locatario", "comprado por", "fechado com", "cliente_nome"]) || "Cliente"),
                closedValue: closedValue || advertisedValue,
                advertisedValue: advertisedValue,
                originChannel: String(getVal(row, ["canal", "origem", "fonte", "meio", "marketing", "origem_lead"]) || "Google Sheets"),
                sellingBrokerId: broker,
                saleDate,
                propertyCaptureDate: captureDate,
                neighborhood,
                listingType: type,
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });
              salesFound++;
            }
            addedCount++;
          } catch (rowError) {
            console.error("Erro ao processar linha:", rowError);
          }
        }

        toast({
          title: "Sincronização Concluída!",
          description: `${addedCount} imóveis no estoque e ${salesFound} vendas identificadas.`,
        });
      } else {
        throw new Error(result.message || "Planilha vazia ou link inválido.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na Sincronização", description: error.message });
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
              <CardTitle className="text-lg">Sincronização Real</CardTitle>
              <CardDescription className="text-xs">Estoque e Vendas da Planilha</CardDescription>
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
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link CSV da Planilha</Label>
          <div className="flex gap-2">
            <Input 
              placeholder="Cole o link .csv aqui..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-white/80"
            />
            <Button onClick={handleSync} disabled={syncing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar"}
            </Button>
          </div>
        </div>
        
        <div className="bg-white/50 p-3 rounded-lg border border-emerald-100 space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <p className="font-bold text-emerald-800 mb-1">Como usar seus dados reais:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>No Google Sheets: <b>Arquivo &gt; Compartilhar &gt; Publicar na Web</b></li>
                <li>Escolha <b>Valores separados por vírgula (.csv)</b></li>
                <li>Copie o link gerado e cole acima</li>
                <li>Clique em <b>Limpar Base Atual</b> se quiser remover os testes antigos</li>
              </ol>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
