
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

  // Função de normalização para bater cabeçalhos
  const normalize = (s: string) => 
    String(s || "").toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const getVal = (row: any, keys: string[]) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedSearchKeys = keys.map(normalize);

    for (const rowKey of rowKeys) {
      const normalizedRowKey = normalize(rowKey);
      if (normalizedSearchKeys.some(sk => normalizedRowKey.includes(sk) || sk.includes(normalizedRowKey))) {
        return row[rowKey];
      }
    }
    return undefined;
  };

  const parseCurrency = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    
    let s = String(val).trim();
    
    // Remove símbolos e espaços (R$, $, etc)
    s = s.replace(/[R$ ]/g, "");
    
    // Caso 1: Tem ponto e vírgula (ex: 3.300.000,00) -> Ponto é milhar, Vírgula é decimal
    if (s.includes('.') && s.includes(',')) {
      s = s.replace(/\./g, "").replace(",", ".");
    } 
    // Caso 2: Tem apenas vírgula (ex: 3300000,00) -> Vírgula é decimal
    else if (s.includes(',')) {
      s = s.replace(",", ".");
    }
    // Caso 3: Tem apenas ponto (ex: 3.300.000) -> Padrão BR, Ponto é milhar
    else if (s.includes('.')) {
      const parts = s.split('.');
      // Se tiver mais de um ponto OU se a última parte tiver exatamente 3 dígitos (milhar)
      // Em valores de imóveis, 3.300.000 é sempre 3 milhões.
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
         s = s.replace(/\./g, "");
      }
    }
    
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  const handleClearData = async () => {
    if (!firestore) return;
    if (!confirm("Isso apagará os dados atuais para uma nova sincronização. Continuar?")) return;
    setClearing(true);
    try {
      const colName = mode === 'inventory' ? "properties" : "vendas_imoveis";
      const snapshot = await getDocs(collection(firestore, colName));
      const batch = writeBatch(firestore);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      toast({ title: "Dados Limpos", description: "Base reiniciada com sucesso." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao limpar", description: error.message });
    } finally {
      setClearing(false);
    }
  };

  const handleSync = async () => {
    if (!url) {
      toast({ variant: "destructive", title: "Link ausente", description: "Insira o link CSV da planilha." });
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
            const rawCode = getVal(row, ["codigo do imovel", "unidade", "referencia", "imovel", "codigo"]);
            const propertyCode = String(rawCode || `REF-${processedCount}`).trim();
            const safeId = propertyCode.replace(/[\/\.\#\$\/\[\]]/g, "-") || `ID-${Date.now()}-${processedCount}`;

            if (mode === 'inventory') {
              const advertisedValue = parseCurrency(getVal(row, ["valor anunciado", "valor", "preco", "anuncio"]));
              const broker = String(getVal(row, ["angariador", "captador", "corretor", "nome"]) || "N/A");
              const neighborhood = String(getVal(row, ["bairro", "empreendimento", "regiao", "localizacao"]) || "Desconhecido");
              const address = String(getVal(row, ["endereco", "logradouro", "rua"]) || "N/A");
              const timestamp = String(getVal(row, ["carimbo", "data", "hora"]) || "");

              const propRef = doc(firestore, "properties", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(propRef, {
                propertyCode,
                address,
                neighborhood,
                listingType: "Venda",
                listingValue: advertisedValue,
                brokerId: broker,
                captureDate: timestamp,
                status: "Disponível",
                importedAt: serverTimestamp(),
                // Campos extras da planilha de estoque
                timestamp: timestamp,
                fullRow: row // Guardamos tudo por segurança
              }, { merge: true });

            } else {
              // MAPEAMENTO TOTAL DAS 19 COLUNAS (MODO CONCLUSAO)
              const dataVendaRaw = getVal(row, ["Data do venda", "assinatura", "fechamento", "data"]);
              const comissaoCantoVal = parseCurrency(getVal(row, ["Qual valor da comissao de venda? (total Canto)"]));
              const comissaoCantoPerc = parseCurrency(getVal(row, ["% para Canto Imoveis"]));
              const valorAnuncio = parseCurrency(getVal(row, ["Qual valor anunciado?"]));
              const valorVenda = parseCurrency(getVal(row, ["Qual valor final de venda?"]));

              const saleRef = doc(firestore, "vendas_imoveis", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(saleRef, {
                timestamp: String(getVal(row, ["Carimbo de data/hora"]) || ""),
                vendedor: String(getVal(row, ["Vendedor"]) || ""),
                tipoVenda: String(getVal(row, ["Tipo de Venda"]) || ""),
                angariador: String(getVal(row, ["Angariador"]) || ""),
                propertyCode: propertyCode,
                imobiliariaCorretor: String(getVal(row, ["Qual imobiliaria/corretor"]) || ""),
                percentualCanto: comissaoCantoPerc,
                construtora: String(getVal(row, ["Construtora/Incorporadora"]) || ""),
                neighborhood: String(getVal(row, ["Empreendimento"]) || "N/A"),
                unit: String(getVal(row, ["Unidade(s)"]) || "N/A"),
                clienteContato: String(getVal(row, ["Qual o nome do cliente que entrou em contato"]) || ""),
                telefone: String(getVal(row, ["telefone"]) || ""),
                email: String(getVal(row, ["email"]) || ""),
                clientName: String(getVal(row, ["O contrato esta no nome de quem?"]) || "N/A"),
                originChannel: String(getVal(row, ["origem do lead?"]) || "Direto"),
                advertisedValue: valorAnuncio,
                closedValue: valorVenda,
                commissionValue: comissaoCantoVal,
                saleDate: String(dataVendaRaw || ""),
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
          description: `${processedCount} registros processados.`,
        });
      } else {
        throw new Error(result.message || "Erro ao ler planilha.");
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
                {mode === 'inventory' ? 'Importar Cadastro de Imóveis' : 'Importar Conclusão de Negócios'}
              </CardTitle>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleClearData} disabled={clearing} className="text-xs text-destructive">
            Limpar Base
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input 
            placeholder="Cole o link CSV da aba correta..." 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button onClick={handleSync} disabled={syncing} className={mode === 'inventory' ? 'bg-primary' : 'bg-emerald-600'}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar"}
          </Button>
        </div>
        <div className="p-3 bg-white/50 border rounded-lg text-[10px] text-muted-foreground flex items-start gap-2">
          <AlertCircle className="h-3 w-3 mt-0.5" />
          <div className="flex flex-col gap-1">
            <p>Lembre-se: No Google Sheets, vá em <b>Arquivo &gt; Compartilhar &gt; Publicar na Web</b>.</p>
            <p>Selecione a <b>Aba Específica</b> correspondente e escolha o formato <b>CSV</b>.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
