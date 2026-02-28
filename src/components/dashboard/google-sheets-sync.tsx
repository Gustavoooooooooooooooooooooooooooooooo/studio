
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCcw, AlertCircle, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { collection, serverTimestamp, getDocs, writeBatch, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

interface GoogleSheetsSyncProps {
  mode: 'inventory' | 'sales';
}

export function GoogleSheetsSync({ mode }: GoogleSheetsSyncProps) {
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  // Função de normalização agressiva para comparação de nomes de colunas
  const normalize = (s: string) => 
    String(s || "").toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  // Função para buscar valor em várias colunas possíveis (sinônimos)
  const getVal = (row: any, keys: string[]) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedSearchKeys = keys.map(normalize);

    for (const rowKey of rowKeys) {
      const normalizedRowKey = normalize(rowKey);
      // Busca exata ou por inclusão
      if (normalizedSearchKeys.some(sk => normalizedRowKey === sk || normalizedRowKey.includes(sk) || sk.includes(normalizedRowKey))) {
        const val = row[rowKey];
        if (val !== undefined && val !== null && String(val).trim() !== "") return val;
      }
    }
    return undefined;
  };

  const parseDate = (val: any) => {
    if (!val) return null;
    const s = String(val).trim();
    if (s === "" || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return null;
    
    // Suporte a DD/MM/YYYY, DD.MM.YYYY ou DD-MM-YYYY
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

  const parseCurrency = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    let s = String(val).trim();
    
    // Remove R$, espaços e caracteres não numéricos, exceto separadores
    s = s.replace(/[^0-9,.]/g, "");

    if (s.includes('.') && s.includes(',')) {
      // Formato brasileiro: 1.250,00 -> 1250.00
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        // Formato americano: 1,250.00 -> 1250.00
        s = s.replace(/,/g, "");
      }
    } else if (s.includes(',')) {
      // Somente vírgula: 1250,00 -> 1250.00
      s = s.replace(",", ".");
    }
    
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  const handleClearData = async () => {
    if (!firestore) return;
    const msg = mode === 'inventory' 
      ? "Isso apagará todo o estoque de angariação para uma nova sincronização limpa. Continuar?"
      : "Isso apagará todo o histórico de vendas para uma nova sincronização limpa. Continuar?";
    
    if (!confirm(msg)) return;

    setClearing(true);
    try {
      const colName = mode === 'inventory' ? "properties" : "vendas_imoveis";
      const snapshot = await getDocs(collection(firestore, colName));
      const batch = writeBatch(firestore);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      
      toast({ 
        title: mode === 'inventory' ? "Estoque Limpo" : "Vendas Limpas", 
        description: "Os dados foram removidos com sucesso." 
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao limpar", description: error.message });
    } finally {
      setClearing(false);
    }
  };

  const handleSync = async () => {
    if (!url) {
      toast({ variant: "destructive", title: "Link ausente", description: "Insira o link CSV da aba correspondente." });
      return;
    }
    if (!firestore) return;

    setSyncing(true);
    try {
      const result = await syncGoogleSheets({ sheetUrl: url });
      
      if (result.success && result.data && result.data.length > 0) {
        let processedCount = 0;
        
        for (const row of result.data) {
          try {
            // Busca o ID do imóvel em várias colunas possíveis
            const rawId = getVal(row, ["imovel", "codigo", "ref", "unidade", "identificador", "id", "p id", "referencia", "cod"]);
            const propertyId = String(rawId || "").trim();
            if (!propertyId || propertyId === "" || propertyId === "undefined") continue;

            // Limpa o ID para o Firestore
            const safePropertyId = propertyId.replace(/\//g, "-").replace(/\\/g, "-");

            if (mode === 'inventory') {
              // Mapeamento de colunas para ESTOQUE (Angariação)
              let typeStr = String(getVal(row, ["tipo", "transacao", "categoria", "operacao", "negocio", "finalidade", "contrato", "venda/locacao"]) || "");
              const isLocacao = typeStr.toLowerCase().includes("loc") || typeStr.toLowerCase().includes("alug") || typeStr.toLowerCase().includes("rent");
              const type = isLocacao ? "Locação" : "Venda";

              // Busca valor em VÁRIAS colunas possíveis
              const advertisedValue = parseCurrency(getVal(row, ["valor anuncio", "valor imovel", "valor venda", "valor locacao", "preco", "pedida", "anuncio", "valor", "venda", "locacao", "total"]));
              const broker = String(getVal(row, ["corretor", "vendedor", "angariador", "responsavel", "consultor", "corretora", "captador", "angariado por"]) || "Não Identificado");
              const neighborhood = String(getVal(row, ["bairro", "regiao", "localidade", "zona", "distrito", "setor", "vizinhanca"]) || "Desconhecido");
              const address = String(getVal(row, ["endereco", "logradouro", "rua", "avenida", "local", "casa", "apto"]) || "Endereço não informado");
              const captureDateStr = getVal(row, ["data entrada", "angariacao", "entrada", "data", "lancamento", "captacao", "inicio", "incluido em"]);
              const captureDate = parseDate(captureDateStr) || new Date().toISOString().split('T')[0];

              const propRef = doc(firestore, "properties", safePropertyId);
              setDocumentNonBlocking(propRef, {
                propertyCode: propertyId,
                address,
                neighborhood,
                listingType: type,
                listingValue: advertisedValue,
                brokerId: broker,
                captureDate,
                status: "Disponível",
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else {
              // Mapeamento de colunas para VENDAS (Fechamentos)
              const closedValue = parseCurrency(getVal(row, ["valor fechado", "valor fechamento", "fechado", "venda final", "venda real", "valor", "valor da venda", "valor do fechamento"]));
              const advertisedValue = parseCurrency(getVal(row, ["valor anuncio", "valor inicial", "pedida", "valor imovel"]));
              const saleDateStr = getVal(row, ["data venda", "fechamento", "venda em", "vendido", "data fechado", "data", "data do fechamento", "fechado em"]);
              const saleDate = parseDate(saleDateStr);
              
              if (!saleDate) continue;

              const saleRef = doc(firestore, "vendas_imoveis", `${safePropertyId}_sale`);
              setDocumentNonBlocking(saleRef, {
                propertyId,
                clientName: String(getVal(row, ["cliente", "comprador", "locatario", "comprado por", "fechado com", "nome do cliente"]) || "Cliente"),
                closedValue: closedValue,
                advertisedValue: advertisedValue || closedValue,
                originChannel: String(getVal(row, ["canal", "origem", "fonte", "meio", "marketing", "proveniencia"]) || "Google Sheets"),
                sellingBrokerId: String(getVal(row, ["corretor", "vendedor", "responsavel", "corretora"]) || "Não Identificado"),
                saleDate,
                neighborhood: String(getVal(row, ["bairro", "regiao", "localidade"]) || "Desconhecido"),
                listingType: "Venda",
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });
            }
            processedCount++;
          } catch (rowError) {
            console.error("Erro ao processar linha:", rowError);
          }
        }

        toast({
          title: "Sincronização Concluída!",
          description: mode === 'inventory' 
            ? `${processedCount} imóveis sincronizados no Estoque.` 
            : `${processedCount} vendas registradas com sucesso.`,
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
    <Card className={`border-none shadow-sm overflow-hidden bg-gradient-to-br ${mode === 'inventory' ? 'from-primary/5 to-white' : 'from-emerald-50 to-white'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${mode === 'inventory' ? 'bg-primary/10 text-primary' : 'bg-emerald-100 text-emerald-600'}`}>
              {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-lg">
                {mode === 'inventory' ? 'Sincronizar Angariação' : 'Sincronizar Vendas'}
              </CardTitle>
              <CardDescription className="text-xs">
                {mode === 'inventory' ? 'Sincronize sua aba de cadastro de estoque' : 'Sincronize sua aba de fechamentos reais'}
              </CardDescription>
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
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link CSV da Aba</Label>
          <div className="flex gap-2">
            <Input 
              placeholder="Cole o link .csv da aba correspondente..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-white/80"
            />
            <Button 
              onClick={handleSync} 
              disabled={syncing} 
              className={mode === 'inventory' ? 'bg-primary' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar"}
            </Button>
          </div>
        </div>
        
        <div className={`p-3 rounded-lg border space-y-2 ${mode === 'inventory' ? 'bg-primary/5 border-primary/10' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`h-4 w-4 mt-0.5 ${mode === 'inventory' ? 'text-primary' : 'text-emerald-600'}`} />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <p className="font-bold mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Dica para capturar tudo:
              </p>
              <p>O sistema agora busca sinônimos. Garanta que suas colunas tenham nomes claros como "Código", "Bairro", "Valor", "Data" ou "Corretor".</p>
              <p className="mt-1">Vá em <b>Arquivo &gt; Compartilhar &gt; Publicar na Web</b>, escolha a <b>Aba Específica</b> e o formato <b>CSV</b>.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
