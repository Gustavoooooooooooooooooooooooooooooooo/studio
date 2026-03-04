
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
import { setDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
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
    if (val === undefined || val === null || String(val).trim() === "") return "";
    const strVal = String(val).trim();
    
    const cleanStr = strVal.replace(/[^\d]/g, '');
    const num = Number(cleanStr);
    
    if (!isNaN(num) && num > 40000 && num < 60000 && !strVal.includes('/') && !strVal.includes('-')) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }

    if (strVal.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) return strVal;

    const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    return strVal;
  };

  const getVal = (row: any, searchKeys: string[]) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalizedRowKeys = rowKeys.map(k => ({ original: k, norm: normalize(k) }));
    const normalizedSearchKeys = searchKeys.map(normalize);

    for (const sKey of normalizedSearchKeys) {
      const match = normalizedRowKeys.find(rk => rk.norm === sKey);
      if (match) return row[match.original];
    }

    for (const sKey of normalizedSearchKeys) {
      const match = normalizedRowKeys.find(rk => rk.norm.includes(sKey) && rk.norm.length < sKey.length + 5);
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
            const rawCode = getVal(row, ["codigo", "unidade", "referencia", "id imovel", "cod imovel", "codigo imovel", "id_imovel"]);
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
                captureDate: String(excelDateToJSDate(getVal(row, ["data entrada", "entrada", "data"])) || ""),
                status: String(getVal(row, ["status", "situacao"]) || "Disponível"),
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'sales') {
              const dataVendaRaw = excelDateToJSDate(getVal(row, ["fechamento", "data venda", "data de venda", "data da venda", "carimbo"]));
              const dataEntradaRaw = excelDateToJSDate(getVal(row, ["data entrada", "entrada", "data da entrada", "cadastro"]));
              const closedVal = parseCurrency(getVal(row, ["valor fechado", "valor venda", "fechamento"]));
              const vendedor = String(getVal(row, ["vendedor", "corretor", "venda", "responsavel"]) || "");
              const cliente = String(getVal(row, ["cliente", "comprador", "nome contrato"]) || "N/A");
              
              const dateKey = String(dataVendaRaw).replace(/\//g, '-');
              const safeSaleId = `sale-${propertyCode}-${normalize(cliente)}-${dateKey}`.replace(/[\/\.\#\$\/\[\]]/g, "-");
              const saleRef = doc(firestore, "vendas_imoveis", safeSaleId);
              
              setDocumentNonBlocking(saleRef, {
                vendedor,
                angariador: String(getVal(row, ["angariador", "captador", "captacao"]) || "N/A"),
                tipoVenda: String(getVal(row, ["tipo venda", "tipo", "operacao", "negocio"]) || "Venda"),
                propertyCode,
                neighborhood: String(getVal(row, ["bairro", "localizacao", "empreendimento"]) || "N/A"),
                clientName: cliente,
                advertisedValue: parseCurrency(getVal(row, ["valor anuncio", "valor inicial", "anuncio"])),
                closedValue: closedVal,
                saleDate: String(dataVendaRaw || ""),
                propertyCaptureDate: String(dataEntradaRaw || ""),
                status: "Vendido",
                importedAt: serverTimestamp(),
              }, { merge: true });

            } else if (mode === 'leads') {
              const leadRef = doc(firestore, "leads", `lead-${processedCount}-${Date.now()}`);
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
                <li>• Use nomes de colunas em Inglês ou Português (Ex: <b>ID</b> ou <b>Código</b>).</li>
                <li>• Na coluna de Código, você pode usar: <code>{`=ARRAYFORMULA(IF(B2:B<>""; ROW(B2:B)-1; ""))`}</code></li>
                <li>• Frequência Venda: <code>{`=IF(COUNT(B2:B)=0; "-"; (TODAY()-DATE(2025;1;1))/COUNT(B2:B))`}</code></li>
                <li>• Garanta que o link do CSV seja público (Arquivo &gt; Compartilhar &gt; Publicar na Web &gt; CSV).</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
