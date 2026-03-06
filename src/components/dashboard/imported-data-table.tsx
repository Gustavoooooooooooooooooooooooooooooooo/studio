
"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Home, Calendar, User, Table2 } from "lucide-react";

const formatDateDisplay = (val: any) => {
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
  return strVal;
};

interface ImportedDataTableProps {
  data: any[];
}

export function ImportedDataTable({ data }: ImportedDataTableProps) {
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
            Base de Cadastro (Consulta Viva)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Visualização direta do estoque capturado na planilha.
          </p>
        </div>
        <Badge variant="outline" className="font-bold text-primary bg-white">
          {data.length} Registros
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {data.length > 0 ? (
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
                  {data.map((imovel, idx) => (
                    <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-b">
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
                Insira o link da planilha para visualizar o estoque em tempo real.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
