
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

  // Função de normalização robusta para bater cabeçalhos
  const normalize = (s: string) => 
    String(s || "").toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const getVal = (row: any, keys: string[]) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedSearchKeys = keys.map(normalize);

    // 1. Busca exata (normalizada)
    for (const rowKey of rowKeys) {
      const normalizedRowKey = normalize(rowKey);
      if (normalizedSearchKeys.includes(normalizedRowKey)) {
        const val = row[rowKey];
        if (val !== undefined && val !== null && String(val).trim() !== "") return val;
      }
    }

    // 2. Busca parcial (o cabeçalho contém uma das palavras-chave ou vice-versa)
    for (const rowKey of rowKeys) {
      const normalizedRowKey = normalize(rowKey);
      if (normalizedSearchKeys.some(sk => normalizedRowKey.includes(sk) || sk.includes(normalizedRowKey))) {
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
    
    // Suporte para DD/MM/YYYY
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
    
    // Remove R$, espaços e outros símbolos, mantendo apenas números, pontos e vírgulas
    s = s.replace(/[^0-9,.]/g, "");

    // Trata formato brasileiro 1.250,00 -> 1250.00
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
    const msg = mode === 'inventory' 
      ? "Isso apagará todo o estoque para uma nova sincronização. Continuar?"
      : "Isso apagará todo o histórico de vendas para uma nova sincronização. Continuar?";
    
    if (!confirm(msg)) return;

    setClearing(true);
    try {
      const colName = mode === 'inventory' ? "properties" : "vendas_imoveis";
      const snapshot = await getDocs(collection(firestore, colName));
      const batch = writeBatch(firestore);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      
      toast({ title: "Dados Limpos", description: "A base de dados foi reiniciada." });
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
        let processedCount = 0;
        
        for (const row of result.data) {
          try {
            // Identificação do Imóvel - Mais robusta
            const rawCode = getVal(row, ["codigo do imovel", "unidade", "referencia", "unidades", "imovel"]);
            const propertyCode = String(rawCode || `REF-${processedCount}`).trim();
            // IDs do Firestore não podem conter barras, substituímos por traços
            const safeId = propertyCode.replace(/[\/\.\#\$\/\[\]]/g, "-");

            if (mode === 'inventory') {
              const advertisedValue = parseCurrency(getVal(row, ["valor anunciado", "valor", "preco", "pedida"]));
              const broker = String(getVal(row, ["angariador", "captador", "corretor", "vendedor"]) || "N/A");
              const neighborhood = String(getVal(row, ["empreendimento", "bairro", "regiao"]) || "Desconhecido");
              const address = String(getVal(row, ["endereco", "logradouro", "rua"]) || "N/A");
              const captureDate = parseDate(getVal(row, ["carimbo de data/hora", "data", "entrada"])) || new Date().toISOString().split('T')[0];

              const propRef = doc(firestore, "properties", safeId);
              setDocumentNonBlocking(propRef, {
                propertyCode,
                address,
                neighborhood,
                listingType: "Venda",
                listingValue: advertisedValue,
                brokerId: broker,
                captureDate,
                status: "Disponível",
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else {
              // Conclusão de Negócios - Mapeamento com nomes reais da planilha
              const closedValue = parseCurrency(getVal(row, ["valor final de venda", "valor fechado", "venda final"]));
              const advertisedValue = parseCurrency(getVal(row, ["valor anunciado", "valor anuncio", "valor inicial"]));
              const commissionValue = parseCurrency(getVal(row, ["valor da comissao de venda", "comissao total", "valor comissao"]));
              const commissionPercent = parseCurrency(getVal(row, ["percentual para canto imoveis", "percentual comissao", "comissao %"]));
              
              const saleDateRaw = getVal(row, ["data do venda", "assinatura", "escritura", "financiamento", "lancamento", "fechamento", "data"]);
              const saleDate = parseDate(saleDateRaw) || new Date().toISOString().split('T')[0];
              
              // Mapeamento dos nomes de clientes (baseado na pergunta da planilha)
              const clientName = String(getVal(row, ["contrato esta no nome de quem", "nome do cliente", "cliente", "comprador"]) || "N/A");
              const seller = String(getVal(row, ["vendedor", "responsavel", "quem vendeu"]) || "N/A");
              const broker = String(getVal(row, ["angariador", "captador"]) || "N/A");
              const origin = String(getVal(row, ["origem do lead", "canal", "marketing"]) || "Direto");
              const developer = String(getVal(row, ["construtora", "incorporadora"]) || "N/A");
              const enterprise = String(getVal(row, ["empreendimento", "bairro", "nome do predio"]) || "N/A");
              const unit = String(getVal(row, ["unidade", "unidades"]) || "N/A");
              const type = String(getVal(row, ["tipo de venda"]) || "Venda");

              const saleRef = doc(firestore, "vendas_imoveis", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(saleRef, {
                propertyId: `${enterprise} - ${unit}`.trim(),
                propertyCode,
                clientName,
                closedValue: closedValue || advertisedValue,
                advertisedValue: advertisedValue || closedValue,
                commissionValue,
                commissionPercent,
                originChannel: origin,
                sellingBrokerId: seller,
                listingBrokerId: broker,
                saleDate,
                neighborhood: enterprise !== "N/A" ? enterprise : "Desconhecido",
                unit,
                developer,
                businessType: type,
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });
            }
            processedCount++;
          } catch (rowError) {
            console.error("Erro na linha:", rowError);
          }
        }

        toast({
          title: "Sincronização Concluída!",
          description: `${processedCount} registros processados com sucesso.`,
        });
      } else {
        throw new Error(result.message || "Planilha sem dados ou link inválido.");
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
                {mode === 'inventory' ? 'Sincronizar Cadastro de Imóveis' : 'Sincronizar Conclusão de Negócios'}
              </CardTitle>
              <CardDescription className="text-xs">
                Importe os dados reais da sua planilha Google
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
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar Agora"}
            </Button>
          </div>
        </div>
        
        <div className={`p-3 rounded-lg border space-y-2 ${mode === 'inventory' ? 'bg-primary/5 border-primary/10' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`h-4 w-4 mt-0.5 ${mode === 'inventory' ? 'text-primary' : 'text-emerald-600'}`} />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <p className="font-bold mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Configuração da Aba:
              </p>
              <p>Certifique-se de que o link aponta para a aba correta (Cadastro ou Conclusão).</p>
              <p className="mt-1">No Google Sheets, vá em <b>Arquivo &gt; Compartilhar &gt; Publicar na Web</b>, selecione a <b>Aba específica</b> e escolha o formato <b>CSV</b>.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
