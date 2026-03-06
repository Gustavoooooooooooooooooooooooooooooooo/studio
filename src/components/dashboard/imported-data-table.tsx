
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Home, Calendar, User, Table2 } from "lucide-react";

// Motor de tratamento de datas especializado
const formatDateDisplay = (val: any) => {
  if (!val || val === "N/A" || String(val).trim() === "") return "N/A";
  if (val?.toDate) {
    const date = val.toDate();
    return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
  }
  const strVal = String(val).trim();
  if (!/\d/.test(strVal)) return "N/A";
  
  // Suporte a ponto: 15.01.2026 -> 15/01/2026
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
  
  return strVal;
};

export function ImportedDataTable() {
  const { firestore, user } = useFirebase();
  
  const angariacaoQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "properties"),
      orderBy("importedAt", "desc")
    );
  }, [firestore, user]);

  const { data: imoveis, isLoading } = useCollection(angariacaoQuery);

  const formatCurrency = (value: number) => {
    if (!value || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL', 
      maximumFractionDigits: 0 
    }).format(value);
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <Table2 className="h-5 w-5" />
            Planilha de Cadastro (Estoque Completo)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Espelhamento automático de todas as colunas da sua planilha de Cadastro.
          </p>
        </div>
        <Badge variant="outline" className="font-bold text-primary bg-white">
          {imoveis?.length || 0} Registros
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">Lendo banco de dados...</p>
          </div>
        ) : imoveis && imoveis.length > 0 ? (
          <ScrollArea className="w-full h-[600px]">
            <div className="min-w-[1000px]">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Data Entrada</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px]">Código/Unidade</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[180px]">Angariador</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Bairro</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase min-w-[150px]">Valor Venda</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase min-w-[150px]">Valor Locação</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px] text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imoveis.map((imovel) => (
                    <TableRow key={imovel.id} className="hover:bg-primary/5 transition-colors border-b">
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{formatDateDisplay(imovel.captureDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-xs text-primary bg-primary/5">
                        {imovel.propertyCode || "S/N"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {imovel.brokerId || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        {imovel.neighborhood || "Desconhecido"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-emerald-600">
                        {formatCurrency(imovel.saleValue)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-indigo-600">
                        {formatCurrency(imovel.rentalValue)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[10px] px-2 ${
                          String(imovel.status).toLowerCase().includes('vend') ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}>
                          {imovel.status || "Disponível"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        ) : (
          <div className="py-24 text-center space-y-4">
            <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <Home className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground font-bold">Base de Cadastro Vazia</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                Sincronize sua planilha de estoque para visualizar os dados aqui.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
