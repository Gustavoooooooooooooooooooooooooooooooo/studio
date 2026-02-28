
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RefreshCcw, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { collection, serverTimestamp, getDocs, writeBatch, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
    s = s.replace(/[R$ ]/g, "");
    
    // Se tiver ponto e vírgula (ex: 3.300.000,00)
    if (s.includes('.') && s.includes(',')) {
      s = s.replace(/\./g, "").replace(",", ".");
    } 
    // Se tiver apenas vírgula (ex: 3300000,00 ou 3,3)
    else if (s.includes(',')) {
      // Se tiver mais de uma vírgula, trata como separador de milhar (errado mas resiliente)
      const parts = s.split(',');
      if (parts.length > 2) s = s.replace(/,/g, "");
      else s = s.replace(",", ".");
    }
    // Se tiver apenas pontos (ex: 3.300.000)
    else if (s.includes('.')) {
      const parts = s.split('.');
      // Se o último grupo tiver 3 dígitos, provavelmente é milhar
      if (parts.length > 1 && parts[parts.length - 1].length === 3) {
         s = s.replace(/\./g, "");
      }
    }
    
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  const handleClearData = async () => {
    if (!firestore) return;
    setClearing(true);
    try {
      const colName = mode === 'inventory' ? "properties" : "vendas_imoveis";
      const snapshot = await getDocs(collection(firestore, colName));
      
      if (snapshot.empty) {
        toast({ title: "Base já está vazia", description: "Não há registros para remover." });
        setClearing(false);
        return;
      }

      const batch = writeBatch(firestore);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      
      toast({ title: "Dados Limpos", description: "Base de " + (mode === 'inventory' ? 'Estoque' : 'Vendas') + " reiniciada com sucesso." });
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
            // Gera um ID baseado no código ou no timestamp
            const rawCode = getVal(row, ["codigo do imovel", "unidade", "referencia", "imovel", "codigo", "unidade"]);
            const propertyCode = String(rawCode || `REF-${Date.now()}-${processedCount}`).trim();
            const safeId = propertyCode.replace(/[\/\.\#\$\/\[\]]/g, "-") || `ID-${Date.now()}-${processedCount}`;

            if (mode === 'inventory') {
              const advertisedValue = parseCurrency(getVal(row, ["valor anunciado", "valor", "preco", "anuncio", "pedida", "valor final"]));
              const broker = String(getVal(row, ["angariador", "captador", "corretor", "nome", "quem angariou"]) || "N/A");
              const neighborhood = String(getVal(row, ["bairro", "empreendimento", "regiao", "localizacao", "local"]) || "Desconhecido");
              const address = String(getVal(row, ["endereco", "logradouro", "rua"]) || "N/A");
              const timestamp = String(getVal(row, ["carimbo", "data", "hora", "data de entrada"]) || "");
              const listingType = String(getVal(row, ["tipo", "transacao", "tipo de imovel"]) || "Venda");
              const status = String(getVal(row, ["status", "situacao", "disponibilidade"]) || "Disponível");

              const propRef = doc(firestore, "properties", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(propRef, {
                propertyCode,
                address,
                neighborhood,
                listingType,
                listingValue: advertisedValue,
                brokerId: broker,
                captureDate: timestamp,
                status,
                importedAt: serverTimestamp(),
                timestamp: timestamp,
              }, { merge: true });

            } else {
              // Modo Vendas (Conclusão)
              const dataVendaRaw = getVal(row, ["Data do venda", "assinatura", "fechamento", "data", "vendido em", "assinatura escritura"]);
              const comissaoCantoVal = parseCurrency(getVal(row, ["Qual valor da comissao de venda? (total Canto)", "comissao total", "comissao valor"]));
              const comissaoCantoPerc = parseCurrency(getVal(row, ["% para Canto Imoveis", "percentual canto", "comissao %"]));
              const valorAnuncio = parseCurrency(getVal(row, ["Qual valor anunciado?", "anuncio", "valor pedida"]));
              const valorVenda = parseCurrency(getVal(row, ["Qual valor final de venda?", "valor fechado", "valor venda"]));

              const saleRef = doc(firestore, "vendas_imoveis", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(saleRef, {
                timestamp: String(getVal(row, ["Carimbo de data/hora"]) || ""),
                vendedor: String(getVal(row, ["Vendedor", "quem vendeu"]) || ""),
                tipoVenda: String(getVal(row, ["Tipo de Venda"]) || ""),
                angariador: String(getVal(row, ["Angariador", "captador"]) || ""),
                propertyCode: propertyCode,
                imobiliariaCorretor: String(getVal(row, ["Qual imobiliaria/corretor"]) || ""),
                percentualCanto: comissaoCantoPerc,
                construtora: String(getVal(row, ["Construtora/Incorporadora", "construtora"]) || ""),
                neighborhood: String(getVal(row, ["Empreendimento", "bairro", "local"]) || "N/A"),
                unit: String(getVal(row, ["Unidade(s)", "apartamento", "sala"]) || "N/A"),
                clientName: String(getVal(row, ["O contrato esta no nome de quem?", "cliente", "nome"]) || "N/A"),
                originChannel: String(getVal(row, ["origem do lead?", "canal", "origem"]) || "Direto"),
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
          description: `${processedCount} registros detectados e enviados para o banco de dados.`,
        });
      } else {
        throw new Error(result.message || "Erro ao ler dados da planilha.");
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
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={clearing} className="text-xs text-destructive hover:bg-destructive hover:text-white border-destructive/20">
                {clearing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                Limpar Base Atual
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todos os dados locais?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá remover todos os registros de {mode === 'inventory' ? 'Cadastro/Estoque' : 'Vendas'} que foram importados anteriormente. 
                  Isso não afeta sua planilha do Google, apenas limpa a visualização do App.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearData} className="bg-destructive hover:bg-destructive/90 text-white">
                  Confirmar e Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input 
            placeholder="Insira o link CSV da aba correta..." 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="bg-white/50"
          />
          <Button onClick={handleSync} disabled={syncing} className={mode === 'inventory' ? 'bg-primary' : 'bg-emerald-600'}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar Agora"}
          </Button>
        </div>
        <div className="p-3 bg-white/50 border rounded-lg text-[10px] text-muted-foreground flex items-start gap-2">
          <AlertCircle className="h-3 w-3 mt-0.5 text-amber-500" />
          <div className="flex flex-col gap-1">
            <p className="font-bold mb-1">Atenção ao Link:</p>
            <p>Certifique-se de que o link aponta para a aba correta da sua planilha do Google.</p>
            <p className="mt-1">Vá em <b>Arquivo &gt; Compartilhar &gt; Publicar na Web</b>, selecione a <b>Aba Específica</b> e escolha o formato <b>CSV</b>.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
