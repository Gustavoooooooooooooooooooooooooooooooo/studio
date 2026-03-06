
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
      .trim();

  const excelDateToJSDate = (val: any) => {
    if (!val || val === "N/A" || String(val).trim() === "") return "N/A";

    const strVal = String(val).trim();

    // Filtro Crítico: Se não tiver número não é data (evita nomes de corretores)
    if (!/\d/.test(strVal)) return "N/A";

    // 1. DD.MM.YYYY → DD/MM/YYYY
    if (strVal.match(/^\d{1,2}\.\d{1,2}\.\d{2,4}$/)) {
      return strVal.replace(/\./g, '/');
    }

    // 2. Serial do Excel
    const cleanStr = strVal.replace(/[^\d]/g, '');
    const num = Number(cleanStr);
    if (!isNaN(num) && num > 40000 && num < 60000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + num * 86400000);
      return `${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${date.getUTCFullYear()}`;
    }

    // 3. DD/MM/YYYY
    if (strVal.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) return strVal;

    // 4. ISO YYYY-MM-DD
    const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    return "N/A";
  };

  const getVal = (row: any, searchKeys: string[], excludeKeys: string[] = []) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedRowKeys = rowKeys.map(k => ({ original: k, norm: normalize(k) }));
    const normalizedSearchKeys = searchKeys.map(normalize);
    const normalizedExcludeKeys = excludeKeys.map(normalize);

    for (const sKey of normalizedSearchKeys) {
      const match = normalizedRowKeys.find(rk => 
        rk.norm === sKey && !normalizedExcludeKeys.some(ex => rk.norm.includes(ex))
      );
      if (match) return row[match.original];
    }

    for (const sKey of normalizedSearchKeys) {
      const match = normalizedRowKeys.find(rk => {
        const isMatch = rk.norm.includes(sKey);
        const isExcluded = normalizedExcludeKeys.some(ex => rk.norm.includes(ex));
        return isMatch && !isExcluded;
      });
      if (match) return row[match.original];
    }

    return undefined;
  };

  const parseCurrency = (val: any) => {
    if (val === undefined || val === null || String(val).trim() === "") return 0;
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
            const rawCode = getVal(row, ["codigo", "unidade", "referencia", "id imovel", "cod imovel", "id_imovel"]);
            const propertyCode = rawCode !== undefined && String(rawCode).trim() !== "" 
              ? String(rawCode).trim() 
              : `REF-${processedCount + 1}`;

            if (mode === 'inventory') {
              const safeId = `prop-${propertyCode}`.replace(/[\/\.\#\$\/\[\]]/g, "-");
              const propRef = doc(firestore, "properties", safeId);
              setDocumentNonBlocking(propRef, {
                propertyCode,
                neighborhood: String(getVal(row, ["bairro", "localizacao", "bairros"]) || "N/A"),
                saleValue: parseCurrency(getVal(row, ["valor venda", "venda", "valor"])),
                rentalValue: parseCurrency(getVal(row, ["valor locacao", "locacao", "aluguel", "valor aluguel"])),
                brokerId: String(getVal(row, ["angariador", "corretor", "captador", "quem angariou"]) || "N/A"),
                captureDate: String(excelDateToJSDate(getVal(row, ["data entrada", "entrada", "data"])) || "N/A"),
                status: String(getVal(row, ["status", "situacao"]) || "Disponível"),
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'sales') {
              const vendedor = String(getVal(row, ["vendedor", "corretor", "responsavel", "atendente"]) || "N/A");
              
              // DATA VENDA (COLUNA R) - Foco Total em capturar data e ignorar nomes
              const dataVendaRaw = excelDateToJSDate(getVal(row, 
                ["data venda", "fechamento", "data fechamento", "r", "venda"], 
                ["vendedor", "corretor", "cliente", "nome", "anuncio"]
              ));
              
              const dataEntradaRaw = excelDateToJSDate(getVal(row, ["data entrada", "entrada", "cadastro"]));
              
              const safeSaleId = `sale-${processedCount}-${Date.now()}`;
              const saleRef = doc(firestore, "vendas_imoveis", safeSaleId);
              
              setDocumentNonBlocking(saleRef, {
                vendedor,
                angariador: String(getVal(row, ["angariador", "captador", "captacao"]) || "N/A"),
                tipoVenda: "Venda",
                propertyCode,
                neighborhood: String(getVal(row, ["bairro", "localizacao", "empreendimento"]) || "N/A"),
                clientName: String(getVal(row, ["cliente", "comprador", "nome contrato"]) || "N/A"),
                advertisedValue: parseCurrency(getVal(row, ["valor anuncio", "valor inicial", "anuncio"])),
                closedValue: parseCurrency(getVal(row, ["valor fechado", "valor venda", "fechamento"])),
                saleDate: String(dataVendaRaw || "N/A"),
                propertyCaptureDate: String(dataEntradaRaw || "N/A"),
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'leads') {
              const leadId = `lead-${processedCount}-${Date.now()}`;
              const leadRef = doc(firestore, "leads", leadId);
              setDocumentNonBlocking(leadRef, { ...row, importedAt: serverTimestamp() }, { merge: true });
            }
            processedCount++;
          } catch (e) { console.error(e); }
        }

        setLastSync(new Date());
        if (!silent) toast({ title: "Sincronização Concluída", description: `${processedCount} registros atualizados.` });
      }
    } catch (error: any) {
      if (!silent) toast({ variant: "destructive", title: "Erro na Sincronização", description: error.message });
    } finally {
      if (!silent) setSyncing(false);
    }
  }, [url, mode, firestore, syncing, toast]);

  useEffect(() => {
    if (!autoSync || !url) return;
    const interval = setInterval(() => handleSync(true), 120000);
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
      toast({ title: "Base Limpa", description: "Todos os dados foram removidos localmente." });
    } catch (e: any) { toast({ variant: "destructive", title: "Erro ao limpar", description: e.message }); }
    finally { setClearing(false); }
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg"><Zap className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle className="text-lg">Sincronização em Tempo Real</CardTitle>
              {lastSync && <p className="text-[10px] text-muted-foreground">Último: {lastSync.toLocaleTimeString()}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleClearData} disabled={clearing} className="text-xs text-destructive">
            {clearing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
            Limpar Base
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Link CSV do Google Sheets..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={() => handleSync()} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar"}
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="auto-sync" checked={autoSync} onCheckedChange={setAutoSync} />
          <Label htmlFor="auto-sync" className="text-xs">Sincronização automática ligada</Label>
        </div>
        
        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mt-4">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-800">Dicas para sua Planilha Google:</p>
              <ul className="text-[10px] text-amber-700 space-y-1">
                <li>• Verifique se a coluna <b>Código</b> ou <b>Referência</b> está preenchida corretamente.</li>
                <li>• Garanta que o link foi gerado em <b>Arquivo &gt; Compartilhar &gt; Publicar na Web &gt; CSV</b>.</li>
                <li>• A Data de Venda (Coluna R) agora é espelhada com precisão absoluta ignorando nomes.</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
