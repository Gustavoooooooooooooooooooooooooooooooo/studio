
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table2, RefreshCcw, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { collection, serverTimestamp, getDocs, writeBatch, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export function GoogleSheetsSync() {
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  // Função auxiliar para encontrar valores em colunas com nomes variados
  const getVal = (row: any, keys: string[]) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    
    for (const key of keys) {
      const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const found = rowKeys.find(k => {
        const normalizedK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return normalizedK === normalizedKey || normalizedK.includes(normalizedKey);
      });
      if (found && row[found] !== undefined && row[found] !== null && row[found] !== "") return row[found];
    }
    return undefined;
  };

  // Conversor de data robusto (suporta DD/MM/YYYY)
  const parseDate = (val: any) => {
    if (!val) return new Date().toISOString().split('T')[0];
    const s = String(val).trim();
    
    const dateMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      let year = parseInt(dateMatch[3]);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
  };

  const parseCurrency = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    let s = String(val).trim();
    s = s.replace(/[^0-9,.]/g, "");

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
    if (!confirm("Isso apagará todos os registros de angariação e vendas atuais. Deseja continuar?")) return;

    setClearing(true);
    try {
      const collectionsToClear = ["vendas_imoveis", "properties", "leads", "visits"];
      for (const colName of collectionsToClear) {
        const snapshot = await getDocs(collection(firestore, colName));
        const batch = writeBatch(firestore);
        snapshot.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      toast({ title: "Banco de Dados Limpo", description: "Todos os registros foram removidos." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao limpar", description: error.message });
    } finally {
      setClearing(false);
    }
  };

  const handleSync = async () => {
    if (!url) {
      toast({ variant: "destructive", title: "URL ausente", description: "Insira a URL da planilha." });
      return;
    }
    if (!firestore) return;

    setSyncing(true);
    try {
      const result = await syncGoogleSheets({ sheetUrl: url });
      
      if (result.success && result.data && result.data.length > 0) {
        let addedCount = 0;
        
        result.data.forEach((row: any) => {
          const propertyId = String(getVal(row, ["imovel", "codigo", "ref", "id", "unidade"]) || "");
          if (!propertyId || propertyId === "" || propertyId === "undefined") return;

          let type = String(getVal(row, ["tipo", "transacao", "categoria", "operacao"]) || "");
          type = (type.toLowerCase().includes("loc") || type.toLowerCase().includes("alug")) ? "Locação" : "Venda";

          const advertisedValue = parseCurrency(getVal(row, ["valor anuncio", "valor imovel", "valor venda", "valor locacao", "preco", "pedida", "valor"]));
          const closedValue = parseCurrency(getVal(row, ["valor fechado", "valor fechamento", "fechado"])) || advertisedValue;

          const broker = String(getVal(row, ["corretor", "vendedor", "angariador", "responsavel"]) || "Não Identificado");
          const captureDate = parseDate(getVal(row, ["data entrada", "angariacao", "entrada", "data", "lancamento"]));
          const saleDate = getVal(row, ["data venda", "fechamento", "venda em"]);
          const neighborhood = String(getVal(row, ["bairro", "regiao", "localidade", "zona"]) || "Desconhecido");
          const address = String(getVal(row, ["endereco", "logradouro", "rua"]) || "Endereço não informado");
          const clientName = String(getVal(row, ["cliente", "comprador", "locatario"]) || "Cliente");
          const origin = String(getVal(row, ["canal", "origem", "fonte"]) || "Google Sheets");

          const propRef = doc(firestore, "properties", propertyId);
          setDocumentNonBlocking(propRef, {
            propertyCode: propertyId,
            address,
            neighborhood,
            listingType: type,
            listingValue: advertisedValue,
            brokerId: broker,
            captureDate,
            status: saleDate ? "Vendido" : "Disponível",
            importedAt: serverTimestamp(),
          }, { merge: true });

          if (saleDate && String(saleDate).length > 5) {
            const saleRef = doc(firestore, "vendas_imoveis", `${propertyId}_sale`);
            setDocumentNonBlocking(saleRef, {
              propertyId,
              clientName,
              closedValue,
              advertisedValue,
              originChannel: origin,
              sellingBrokerId: broker,
              saleDate: parseDate(saleDate),
              propertyCaptureDate: captureDate,
              neighborhood,
              listingType: type,
              status: "Vendido",
              importedAt: serverTimestamp(),
            }, { merge: true });
          }
          addedCount++;
        });

        toast({
          title: "Sincronização Concluída",
          description: `${addedCount} registros processados.`,
        });
      } else {
        toast({ variant: "destructive", title: "Nenhum dado", description: "Verifique se a planilha está publicada corretamente." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro na sincronização", description: "Erro ao processar os dados da planilha." });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Table2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Sincronização de Dados</CardTitle>
              <CardDescription className="text-xs">Importe seus registros reais do Google Sheets</CardDescription>
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
            Limpar Banco de Dados
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link CSV da Planilha</Label>
          <div className="flex gap-2">
            <Input 
              placeholder="Cole o link aqui..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-white/80"
            />
            <Button 
              onClick={handleSync} 
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="bg-white/50 p-3 rounded-lg border border-emerald-100 flex items-start gap-3">
          <div className="mt-0.5">
             <AlertCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <p className="font-bold text-emerald-800 mb-1">Dicas Importantes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><b>Publicação:</b> No Google Sheets, vá em Arquivo {' > '} Compartilhar {' > '} Publicar na Web.</li>
              <li><b>Formato:</b> Escolha "Valores separados por vírgula (.csv)".</li>
              <li><b>Sincronismo:</b> O Google pode demorar até 5 min para atualizar o link público.</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
