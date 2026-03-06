
"use client"

import { useMemo } from "react";
import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, BadgeCheck } from "lucide-react";

const formatDateDisplay = (val: any) => {
  if (!val || val === "N/A" || String(val).trim() === "") return "N/A";

  // 1️⃣ Firebase Timestamp
  if (val?.toDate) {
    const date = val.toDate();
    return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
  }

  const strVal = String(val).trim();

  // 2️⃣ Se não tiver número não é data
  if (!/\d/.test(strVal)) return "N/A";

  // 3️⃣ DD.MM.YYYY → DD/MM/YYYY
  if (strVal.match(/^\d{1,2}\.\d{1,2}\.\d{2,4}$/)) {
    return strVal.replace(/\./g, '/');
  }

  // 4️⃣ Serial do Excel (45961, 46037 etc.)
  const cleanStr = strVal.replace(/[^\d]/g, '');
  const num = Number(cleanStr);

  if (!isNaN(num) && num > 40000 && num < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    return `${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${date.getUTCFullYear()}`;
  }

  // 5️⃣ DD/MM/YYYY
  if (strVal.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) return strVal;

  // 6️⃣ ISO YYYY-MM-DD
  const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  return "N/A";
};

export function SalesDataTable() {
  const { firestore } = useFirebase();
  
  const vendasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "vendas_imoveis"),
      orderBy("importedAt", "desc")
    );
  }, [firestore]);

  const { data: rawVendas, isLoading } = useCollection(vendasQuery);
  const vendas = rawVendas || [];

  const formatCurrency = (value: any) => {
    const num = Number(value);
    if (isNaN(num) || !num) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL', 
      maximumFractionDigits: 0 
    }).format(num);
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-emerald-50/50 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-emerald-600" />
            Planilha de Conclusão de Negócios
          </CardTitle>
          <p className="text-xs text-muted-foreground">Exibindo todos os fechamentos registrados com tratamento de datas.</p>
        </div>
        <Badge variant="outline" className="text-emerald-600 font-bold bg-white">
          {vendas?.length || 0} Registros
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm text-muted-foreground">Carregando fechamentos...</p>
          </div>
        ) : vendas && vendas.length > 0 ? (
          <ScrollArea className="w-full h-[600px]">
            <div className="min-w-[1800px]">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px]">Data Entrada</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px] bg-emerald-100/50">Data Venda</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Vendedor</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px]">Tipo Venda</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Angariador</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px]">Cód Imóvel</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[200px]">Bairro/Local</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[200px]">Nome Contrato</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px] text-right">Valor Anúncio</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px] text-right">Valor Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendas.map((venda, idx) => (
                    <TableRow key={venda.id || idx} className="hover:bg-emerald-50/30 transition-colors border-b">
                      <TableCell className="text-xs text-muted-foreground">{formatDateDisplay(venda.propertyCaptureDate)}</TableCell>
                      <TableCell className="text-xs font-bold text-emerald-700 bg-emerald-50/40">
                        {formatDateDisplay(venda.saleDate)}
                      </TableCell>
                      <TableCell className="text-xs">{venda.vendedor || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.tipoVenda || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.angariador || "N/A"}</TableCell>
                      <TableCell className="text-xs font-mono">{venda.propertyCode || "N/A"}</TableCell>
                      <TableCell className="text-xs font-semibold">{venda.neighborhood || "N/A"}</TableCell>
                      <TableCell className="text-xs font-bold">{venda.clientName || "N/A"}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">{formatCurrency(venda.advertisedValue)}</TableCell>
                      <TableCell className="text-xs text-right font-bold text-emerald-600">{formatCurrency(venda.closedValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        ) : (
          <div className="py-32 text-center text-muted-foreground space-y-4">
            <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto opacity-20">
               <BadgeCheck className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">Sincronize a aba de Conclusão para visualizar os dados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
