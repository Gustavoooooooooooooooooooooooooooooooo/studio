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
  mode: 'inventory' | 'sales' | 'leads';
}

export function GoogleSheetsSync({ mode }: GoogleSheetsSyncProps) {
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();

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
      if (normalizedSearchKeys.some(sk => normalizedRowKey === sk || normalizedRowKey.includes(sk))) {
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
    
    // Suporte a milhões com pontos (Ex: 3.300.000)
    if (s.includes('.') && s.includes(',')) {
      s = s.replace(/\./g, "").replace(",", ".");
    } 
    else if (s.includes('.') && s.split('.').every((part, i) => i === 0 || part.length === 3)) {
      s = s.replace(/\./g, "");
    }
    else if (s.includes(',')) {
      s = s.replace(",", ".");
    }
    
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  const handleClearData = async () => {
    if (!firestore) return;
    setClearing(true);
    try {
      let colName = "properties";
      if (mode === 'sales') colName = "vendas_imoveis";
      if (mode === 'leads') colName = "leads";
      
      const snapshot = await getDocs(collection(firestore, colName));
      
      if (snapshot.empty) {
        toast({ title: "Base já está vazia", description: "Não há registros para remover." });
        setClearing(false);
        return;
      }

      const batch = writeBatch(firestore);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      
      toast({ title: "Dados Limpos", description: "Base de " + (mode === 'inventory' ? 'Estoque' : mode === 'sales' ? 'Vendas' : 'Leads') + " reiniciada com sucesso." });
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
            const rawCode = getVal(row, ["codigo", "referencia", "unidade", "id"]);
            const propertyCode = String(rawCode || `REF-${Date.now()}-${processedCount}`).trim();
            const safeId = propertyCode.replace(/[\/\.\#\$\/\[\]]/g, "-") || `ID-${Date.now()}-${processedCount}`;

            if (mode === 'inventory') {
              const saleValue = parseCurrency(getVal(row, ["valor de venda", "venda", "valor venda"]));
              const rentalValue = parseCurrency(getVal(row, ["valor de locacao", "locacao", "valor locacao", "aluguel"]));
              const broker = String(getVal(row, ["angariador", "captador", "corretor", "nome"]) || "N/A");
              const neighborhood = String(getVal(row, ["bairro", "regiao"]) || "Desconhecido");
              const timestamp = String(getVal(row, ["carimbo", "data de entrada", "data"]) || "");
              const status = String(getVal(row, ["status", "situacao"]) || "Disponível");

              const propRef = doc(firestore, "properties", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(propRef, {
                propertyCode,
                neighborhood,
                saleValue,
                rentalValue,
                brokerId: broker,
                captureDate: timestamp,
                status,
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'sales') {
              const dataVendaRaw = getVal(row, ["Data do venda", "assinatura", "fechamento", "data"]);
              const comissaoCantoVal = parseCurrency(getVal(row, ["Qual valor da comissao de venda? (total Canto)", "comissao total"]));
              const comissaoCantoPerc = parseCurrency(getVal(row, ["% para Canto Imoveis", "percentual canto"]));
              const valorAnuncio = parseCurrency(getVal(row, ["Qual valor anunciado?", "anuncio"]));
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
                construtora: String(getVal(row, ["Construtora/Incorporadora"]) || ""),
                neighborhood: String(getVal(row, ["Empreendimento", "bairro"]) || "N/A"),
                unit: String(getVal(row, ["Unidade(s)", "apartamento"]) || "N/A"),
                clientName: String(getVal(row, ["O contrato esta no nome de quem?", "cliente"]) || "N/A"),
                originChannel: String(getVal(row, ["origem do lead?", "canal"]) || "Direto"),
                advertisedValue: valorAnuncio,
                closedValue: valorVenda,
                commissionValue: comissaoCantoVal,
                saleDate: String(dataVendaRaw || ""),
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });
            } else if (mode === 'leads') {
              const leadData: any = {
                importedAt: serverTimestamp(),
              };
              
              Object.keys(row).forEach(key => {
                leadData[key] = row[key];
              });

              const leadRef = doc(firestore, "leads", `LEAD-${Date.now()}-${processedCount}`);
              setDocumentNonBlocking(leadRef, leadData, { merge: true });
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
    <Card className={`border-none shadow-sm overflow-hidden bg-gradient-to-br ${mode === 'inventory' ? 'from-primary/5 to-white' : mode === 'sales' ? 'from-emerald-50 to-white' : 'from-indigo-50 to-white'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${mode === 'inventory' ? 'bg-primary/10 text-primary' : mode === 'sales' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
              {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-lg">
                {mode === 'inventory' ? 'Importar Cadastro de Imóveis' : mode === 'sales' ? 'Importar Conclusão de Negócios' : 'Importar Base de Leads'}
              </CardTitle>
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={clearing} className="text-xs text-destructive hover:bg-destructive hover:text-white border-destructive/20">
                {clearing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                Limpar Base
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todos os dados locais?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá remover todos os registros de {mode === 'inventory' ? 'Cadastro' : mode === 'sales' ? 'Vendas' : 'Leads'} que foram importados. 
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
          <Button onClick={handleSync} disabled={syncing} className={mode === 'inventory' ? 'bg-primary' : mode === 'sales' ? 'bg-emerald-600' : 'bg-indigo-600'}>
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
