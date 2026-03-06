"use client"

import { useState, useEffect, useCallback, useRef } from "react";
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
  const { firestore, user } = useFirebase();
  
  const syncingRef = useRef(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem(`sheet_url_${mode}`);
    if (savedUrl) setUrl(savedUrl);
    const savedAutoSync = localStorage.getItem(`auto_sync_${mode}`);
    if (savedAutoSync !== null) setAutoSync(savedAutoSync === 'true');
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(`auto_sync_${mode}`, String(autoSync));
  }, [autoSync, mode]);

  const normalize = (s: string) => 
    String(s || "").toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const excelDateToJSDate = (val: any) => {
    if (!val || val === "N/A" || String(val).trim() === "") return "N/A";
    const strVal = String(val).trim();
    
    if (!/\d/.test(strVal)) return "N/A";

    if (strVal.match(/^\d{1,2}\.\d{1,2}\.\d{2,4}$/)) {
      return strVal.replace(/\./g, '/');
    }

    const cleanStr = strVal.replace(/[^\d]/g, '');
    const num = Number(cleanStr);
    if (!isNaN(num) && num > 40000 && num < 60000 && !strVal.includes('/') && !strVal.includes('.') && !strVal.includes('-')) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + num * 86400000);
      return `${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${date.getUTCFullYear()}`;
    }

    const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    return strVal;
  };

  const getVal = (row: any, searchKeys: string[], excludeKeys: string[] = []) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedSearch = searchKeys.map(normalize);
    const normalizedExclude = excludeKeys.map(normalize);

    for (const sKey of normalizedSearch) {
      const match = rowKeys.find(rk => {
        const nrk = normalize(rk);
        const isMatch = nrk === sKey || nrk.includes(sKey);
        const isExcluded = normalizedExclude.some(ex => nrk.includes(ex));
        return isMatch && !isExcluded;
      });
      if (match) {
        const val = row[match];
        if (sKey.includes("data")) {
          if (val && !/\d/.test(String(val))) continue;
        }
        return val;
      }
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
    if (!url || !firestore || !user || syncingRef.current) return;
    
    syncingRef.current = true;
    if (!silent) setSyncing(true);
    
    try {
      localStorage.setItem(`sheet_url_${mode}`, url);
      const result = await syncGoogleSheets({ sheetUrl: url });
      
      if (result.success && result.data && result.data.length > 0) {
        let processedCount = 0;
        
        for (const row of result.data) {
          try {
            const rawCode = getVal(row, ["codigo", "unidade", "referencia", "id_imovel"]);
            const propertyCode = rawCode !== undefined && String(rawCode).trim() !== "" 
              ? String(rawCode).trim() 
              : `REF-${processedCount + 1}`;

            if (mode === 'inventory') {
              const safeId = `prop-${propertyCode}`.replace(/[\/\.\#\$\/\[\]]/g, "-");
              const propRef = doc(firestore, "properties", safeId);
              setDocumentNonBlocking(propRef, {
                propertyCode,
                neighborhood: String(getVal(row, ["bairro", "localizacao"]) || "N/A"),
                saleValue: parseCurrency(getVal(row, ["valor venda", "venda"])),
                rentalValue: parseCurrency(getVal(row, ["valor locacao", "aluguel"])),
                brokerId: String(getVal(row, ["angariador", "corretor", "captador"]) || "N/A"),
                captureDate: excelDateToJSDate(getVal(row, ["data entrada", "entrada", "cadastro"])),
                status: String(getVal(row, ["status", "situacao"]) || "Disponível"),
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'sales') {
              const dataVenda = excelDateToJSDate(getVal(row, ["data do venda", "data venda", "fechamento"], ["vendedor", "corretor"]));
              const vendedor = String(getVal(row, ["vendedor", "corretor", "responsavel"]) || "N/A");
              
              const saleIdSeed = `${propertyCode}-${vendedor}-${dataVenda}`;
              const safeSaleId = `sale-${saleIdSeed.replace(/[\/\.\#\$\/\[\] ]/g, "-")}`;
              const saleRef = doc(firestore, "vendas_imoveis", safeSaleId);
              
              setDocumentNonBlocking(saleRef, {
                vendedor,
                angariador: String(getVal(row, ["angariador", "captador"]) || "N/A"),
                propertyCode,
                neighborhood: String(getVal(row, ["bairro", "localizacao"]) || "N/A"),
                clientName: String(getVal(row, ["cliente", "comprador"]) || "N/A"),
                advertisedValue: parseCurrency(getVal(row, ["valor anuncio", "anuncio"])),
                closedValue: parseCurrency(getVal(row, ["valor fechado", "valor venda"])),
                saleDate: dataVenda,
                propertyCaptureDate: excelDateToJSDate(getVal(row, ["data entrada", "entrada", "cadastro"])),
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'leads') {
              // Gerar um ID baseado no conteúdo da linha para evitar duplicatas e permitir atualizações
              const rowHash = Object.values(row).join("").substring(0, 80).replace(/[\/\.\#\$\/\[\] ]/g, "-");
              const leadId = `lead-${rowHash}`;
              const leadRef = doc(firestore, "leads", leadId);
              setDocumentNonBlocking(leadRef, { 
                ...row, 
                importedAt: serverTimestamp() 
              }, { merge: true });
            }
            processedCount++;
          } catch (e) { console.error(e); }
        }

        setLastSync(new Date());
        if (!silent) {
          toast({ title: "Sincronização Concluída", description: `${processedCount} registros sincronizados.` });
        }
      }
    } catch (error: any) {
      if (!silent) toast({ variant: "destructive", title: "Erro na Sincronização", description: error.message });
    } finally {
      syncingRef.current = false;
      if (!silent) setSyncing(false);
    }
  }, [url, mode, firestore, user, toast]);

  // Monitoramento contínuo
  useEffect(() => {
    if (!autoSync || !url || !user) return;
    
    // Sincronização imediata
    handleSync(true);

    const intervalId = setInterval(() => {
      handleSync(true);
    }, 60000); // 60 segundos
    
    return () => clearInterval(intervalId);
  }, [autoSync, url, user, handleSync]);

  const handleClearData = async () => {
    if (!firestore || !user) return;
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
              <CardTitle className="text-lg">Sincronização de {mode === 'leads' ? 'Leads' : mode === 'inventory' ? 'Cadastro' : 'Vendas'}</CardTitle>
              {lastSync && <p className="text-[10px] text-muted-foreground">Sincronizado em: {lastSync.toLocaleTimeString()}</p>}
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
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sincronizar Agora"}
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id={`auto-sync-${mode}`} checked={autoSync} onCheckedChange={setAutoSync} />
          <Label htmlFor={`auto-sync-${mode}`} className="text-xs">Sincronização automática ativa (60s)</Label>
          {syncing && <span className="text-[10px] text-primary animate-pulse font-bold uppercase ml-2">Atualizando...</span>}
        </div>
        
        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mt-4">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-800">Instruções para Espelhamento:</p>
              <ul className="text-[10px] text-amber-700 space-y-1">
                <li>• No Google Sheets: Arquivo &amp;gt; Compartilhar &amp;gt; Publicar na Web &amp;gt; CSV.</li>
                <li>• Qualquer alteração na planilha será refletida aqui automaticamente.</li>
                <li>• Para Vendas, certifique-se da coluna "Data do venda".</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
