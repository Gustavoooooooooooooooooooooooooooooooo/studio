
"use client"

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RefreshCcw, AlertCircle, Loader2, Trash2, Zap, Info } from "lucide-react";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { collection, serverTimestamp, getDocs, writeBatch, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  const [autoSync, setAutoSync] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  useEffect(() => {
    const savedUrl = localStorage.getItem(`sheet_url_${mode}`);
    if (savedUrl) setUrl(savedUrl);
  }, [mode]);

  const normalize = (s: string) => 
    String(s || "").toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const excelDateToJSDate = (serial: any) => {
    if (serial === undefined || serial === null || serial === "") return "";
    let s = String(serial).replace(/[\.,]/g, "").trim();
    const num = Number(s);
    // Range de 2024 a 2030 (Excel serial dates: 45000 a 60000)
    if (!isNaN(num) && num > 45000 && num < 60000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }
    return String(serial);
  };

  const getVal = (row: any, searchKeys: string[], isDateSearch = false) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedSearchKeys = searchKeys.map(normalize);

    // 1. Busca Exata
    for (const rowKey of rowKeys) {
      const normRowKey = normalize(rowKey);
      if (normalizedSearchKeys.includes(normRowKey)) {
        return row[rowKey];
      }
    }

    // 2. Busca Parcial com filtros inteligentes
    for (const rowKey of rowKeys) {
      const normRowKey = normalize(rowKey);
      
      // Se estamos buscando DATA, ignoramos colunas financeiras ou carimbos de sistema
      if (isDateSearch && (normRowKey.includes("valor") || normRowKey.includes("preco") || normRowKey.includes("carimbo") || normRowKey.includes("timestamp"))) {
        continue;
      }

      // Se estamos buscando VALOR, ignoramos colunas de data
      if (!isDateSearch && normRowKey.includes("data")) {
        continue;
      }

      if (normalizedSearchKeys.some(sk => normRowKey.includes(sk))) {
        return row[rowKey];
      }
    }
    return undefined;
  };

  const parseCurrency = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    let s = String(val).trim().replace(/[R$ ]/g, "");
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(',') && !s.includes('.')) s = s.replace(",", ".");
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  const handleSync = useCallback(async (silent = false) => {
    if (!url || syncing || !firestore) return;
    if (!silent) setSyncing(true);
    
    try {
      localStorage.setItem(`sheet_url_${mode}`, url);
      const result = await syncGoogleSheets({ sheetUrl: url });
      
      if (result.success && result.data && result.data.length > 0) {
        let processedCount = 0;
        
        for (const row of result.data) {
          try {
            const rawCode = getVal(row, ["codigo", "referencia", "unidade", "id"]);
            const propertyCode = String(rawCode || `REF-${Date.now()}-${processedCount}`).trim();
            const safeId = propertyCode.replace(/[\/\.\#\$\/\[\]]/g, "-");

            if (mode === 'inventory') {
              const saleValue = parseCurrency(getVal(row, ["valor venda"]));
              const rentalValue = parseCurrency(getVal(row, ["valor locacao", "aluguel"]));
              const broker = String(getVal(row, ["angariador", "corretor"]) || "N/A");
              const neighborhood = String(getVal(row, ["bairro"]) || "N/A");
              const timestamp = excelDateToJSDate(getVal(row, ["data entrada"], true));
              const status = String(getVal(row, ["status"]) || "Disponível");

              const propRef = doc(firestore, "properties", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(propRef, {
                propertyCode, neighborhood, saleValue, rentalValue,
                brokerId: broker, captureDate: String(timestamp || ""), status, importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'sales') {
              // MAPEAMENTO AMPLO PARA DATA VENDA (COLUNA S)
              const dataVendaRaw = excelDateToJSDate(getVal(row, ["data venda", "data da venda", "fechamento", "data do fechamento", "venda"], true));
              const dataEntradaRaw = excelDateToJSDate(getVal(row, ["data entrada", "data da entrada", "entrada", "captura", "angariacao"], true));
              
              const valorAnuncio = parseCurrency(getVal(row, ["valor anuncio", "anuncio"]));
              const valorVenda = parseCurrency(getVal(row, ["valor fechado", "valor venda", "venda"]));

              const saleRef = doc(firestore, "vendas_imoveis", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(saleRef, {
                vendedor: String(getVal(row, ["vendedor", "corretor", "corretor venda"]) || ""),
                tipoVenda: String(getVal(row, ["tipo de venda", "tipo", "transacao"]) || ""),
                angariador: String(getVal(row, ["angariador", "corretor angariador"]) || ""),
                propertyCode,
                neighborhood: String(getVal(row, ["bairro", "empreendimento", "localizacao"]) || "N/A"),
                unit: String(getVal(row, ["unidade", "apto", "casa"]) || "N/A"),
                clientName: String(getVal(row, ["cliente", "comprador", "nome contrato"]) || "N/A"),
                originChannel: String(getVal(row, ["origem", "canal", "origem lead"]) || "Direto"),
                advertisedValue: valorAnuncio,
                closedValue: valorVenda,
                saleDate: String(dataVendaRaw || ""),
                propertyCaptureDate: String(dataEntradaRaw || ""),
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });
            } else if (mode === 'leads') {
              const leadData: any = { importedAt: serverTimestamp() };
              Object.keys(row).forEach(key => { 
                leadData[key] = key.toLowerCase().includes('data') ? excelDateToJSDate(row[key]) : row[key]; 
              });
              const leadRef = doc(firestore, "leads", `LEAD-${processedCount}-${safeId}`);
              setDocumentNonBlocking(leadRef, leadData, { merge: true });
            }
            processedCount++;
          } catch (rowError) {
            console.error("Erro na linha:", rowError);
          }
        }

        setLastSync(new Date());
        if (!silent) {
          toast({
            title: "Sincronização Concluída!",
            description: `${processedCount} registros atualizados.`,
          });
        }
      } else if (!silent) {
        toast({
          variant: "destructive",
          title: "Erro na Planilha",
          description: result.message || "Não foi possível ler os dados.",
        });
      }
    } catch (error: any) {
      if (!silent) {
        toast({ 
          variant: "destructive", 
          title: "Erro na Sincronização", 
          description: error.message || "Verifique o link da planilha."
        });
      }
    } finally {
      if (!silent) setSyncing(false);
    }
  }, [url, mode, firestore, syncing, toast]);

  useEffect(() => {
    if (!autoSync || !url) return;
    handleSync(true);
    const interval = setInterval(() => handleSync(true), 60000);
    return () => clearInterval(interval);
  }, [autoSync, url, handleSync]);

  const handleClearData = async () => {
    if (!firestore) return;
    setClearing(true);
    try {
      let colName = mode === 'inventory' ? "properties" : mode === 'sales' ? "vendas_imoveis" : "leads";
      const snapshot = await getDocs(collection(firestore, colName));
      const batch = writeBatch(firestore);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      toast({ title: "Base Limpa", description: "Todos os dados locais foram removidos." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao limpar", description: error.message });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className={`border-none shadow-sm overflow-hidden bg-gradient-to-br ${mode === 'inventory' ? 'from-primary/5 to-white' : mode === 'sales' ? 'from-emerald-50 to-white' : 'from-indigo-50 to-white'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${mode === 'inventory' ? 'bg-primary/10 text-primary' : mode === 'sales' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
              {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className={`h-5 w-5 ${autoSync ? 'animate-pulse' : ''}`} />}
            </div>
            <div>
              <CardTitle className="text-lg">
                {mode === 'inventory' ? 'Cadastro de Imóveis' : mode === 'sales' ? 'Conclusão de Negócios' : 'Base de Leads'}
              </CardTitle>
              {lastSync && <p className="text-[10px] text-muted-foreground">Última atualização: {lastSync.toLocaleTimeString()}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 bg-white/50 px-3 py-1.5 rounded-full border border-primary/10">
              <Switch id="auto-sync" checked={autoSync} onCheckedChange={setAutoSync} className="data-[state=checked]:bg-primary" />
              <Label htmlFor="auto-sync" className="text-[10px] font-bold cursor-pointer uppercase">Tempo Real</Label>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={clearing} className="text-xs text-destructive border-destructive/20">
                  {clearing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Limpar Base Atual
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todos os dados?</AlertDialogTitle>
                  <AlertDialogDescription>Essa ação remove os registros locais de {mode === 'inventory' ? 'Imóveis' : mode === 'sales' ? 'Vendas' : 'Leads'} para forçar uma nova sincronização limpa.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData} className="bg-destructive hover:bg-destructive/90 text-white">Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Cole o link CSV da planilha (Publicada na Web)..." value={url} onChange={(e) => setUrl(e.target.value)} className="bg-white/50" />
          <Button onClick={() => handleSync()} disabled={syncing} className={mode === 'inventory' ? 'bg-primary' : mode === 'sales' ? 'bg-emerald-600' : 'bg-indigo-600'}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar Agora"}
          </Button>
        </div>
        
        <div className="flex items-start gap-2 bg-white/40 p-3 rounded-lg border border-primary/5 text-[11px] text-muted-foreground">
          <div className="space-y-1">
            <p className="font-bold mb-1 flex items-center gap-1">
               <Info className="h-3 w-3 text-primary" /> Dica de Precisão 2026:
            </p>
            <p>O sistema agora detecta o código <b>46037</b> como <b>15/01/2026</b>.</p>
            <p className="mt-1">Clique em <b>Limpar Base Atual</b> se a data aparecer como N/A para forçar o novo mapeamento.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
