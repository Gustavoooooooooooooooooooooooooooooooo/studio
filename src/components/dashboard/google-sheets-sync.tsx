
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
    if (serial === undefined || serial === null || serial === "") return serial;
    let s = String(serial).replace(/[\.,]/g, "").trim();
    const num = Number(s);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }
    return serial;
  };

  const getVal = (row: any, searchKeys: string[], isDateSearch = false) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedSearchKeys = searchKeys.map(normalize);

    for (const rowKey of rowKeys) {
      const normRowKey = normalize(rowKey);
      if (isDateSearch && (normRowKey.includes("carimbo") || normRowKey.includes("timestamp"))) continue;
      
      if (normalizedSearchKeys.includes(normRowKey)) {
        return row[rowKey];
      }
    }

    for (const rowKey of rowKeys) {
      const normRowKey = normalize(rowKey);
      if (isDateSearch && (normRowKey.includes("carimbo") || normRowKey.includes("timestamp"))) continue;
      
      if (isDateSearch && (normRowKey.includes("valor") || normRowKey.includes("vgv") || normRowKey.includes("anuncio"))) continue;

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
            const safeId = propertyCode.replace(/[\/\.\#\$\/\[\]]/g, "-") || `ID-${Date.now()}-${processedCount}`;

            if (mode === 'inventory') {
              const saleValue = parseCurrency(getVal(row, ["venda"]));
              const rentalValue = parseCurrency(getVal(row, ["locacao", "aluguel"]));
              const broker = String(getVal(row, ["angariador", "captador", "corretor"]) || "N/A");
              const neighborhood = String(getVal(row, ["bairro", "regiao"]) || "N/A");
              const timestamp = excelDateToJSDate(getVal(row, ["data entrada", "entrada"], true));
              const status = String(getVal(row, ["status", "situacao"]) || "Disponível");

              const propRef = doc(firestore, "properties", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(propRef, {
                propertyCode, neighborhood, saleValue, rentalValue,
                brokerId: broker, captureDate: String(timestamp || ""), status, importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'sales') {
              // BUSCA RIGOROSA PARA DATA VENDA (COLUNA S) - IGNORA CARIMBO
              const dataVendaRaw = excelDateToJSDate(getVal(row, ["data venda", "data da venda", "fechamento", "assinatura"], true));
              const dataEntradaRaw = excelDateToJSDate(getVal(row, ["data entrada", "data de entrada", "entrada"], true));
              
              const valorAnuncio = parseCurrency(getVal(row, ["anuncio", "valor anunciado"]));
              const valorVenda = parseCurrency(getVal(row, ["valor fechado", "valor venda"]));

              const saleRef = doc(firestore, "vendas_imoveis", `${safeId}-${processedCount}`);
              setDocumentNonBlocking(saleRef, {
                vendedor: String(getVal(row, ["vendedor"]) || ""),
                tipoVenda: String(getVal(row, ["tipo de venda"]) || ""),
                angariador: String(getVal(row, ["angariador"]) || ""),
                propertyCode,
                neighborhood: String(getVal(row, ["empreendimento", "bairro"]) || "N/A"),
                unit: String(getVal(row, ["unidade"]) || "N/A"),
                clientName: String(getVal(row, ["cliente", "nome contrato"]) || "N/A"),
                originChannel: String(getVal(row, ["origem", "canal"]) || "Direto"),
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
      }
    } catch (error: any) {
      if (!silent) toast({ variant: "destructive", title: "Erro na Sincronização", description: error.message });
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
            <p>O sistema agora foca exclusivamente na <b>Data Venda real</b> e ignora o Carimbo de Data.</p>
            <p className="mt-1">Após colar o link, clique em <b>Sincronizar Agora</b> para recalcular os indicadores.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
