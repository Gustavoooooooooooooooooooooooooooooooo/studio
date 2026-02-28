
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BadgeCheck, Calendar, User, TrendingUp, Share2, Building2 } from "lucide-react";

export function SalesDataTable() {
  const { firestore } = useFirebase();
  
  const vendasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "vendas_imoveis"),
      orderBy("importedAt", "desc"),
      limit(100)
    );
  }, [firestore]);

  const { data: vendas, isLoading } = useCollection(vendasQuery);

  const formatCurrency = (value: number) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL', 
      maximumFractionDigits: 0 
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/D";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-emerald-50/50 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-emerald-600" />
            Vendas Realizadas (Dados Sincronizados)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Visualização dos últimos fechamentos importados da sua planilha.
          </p>
        </div>
        <Badge variant="outline" className="text-emerald-600 font-bold">
          {vendas?.length || 0} Registros
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm text-muted-foreground font-medium">Lendo registros de venda...</p>
          </div>
        ) : vendas && vendas.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[10px] font-bold uppercase text-emerald-900">Empreendimento / Unidade</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-emerald-900">Data Venda</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-emerald-900">Cliente (Contrato)</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-emerald-900">Origem</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-emerald-900">Vendedor</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase text-emerald-900">Comissão (R$)</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase text-emerald-900">Valor Fechado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((venda) => (
                  <TableRow key={venda.id} className="hover:bg-emerald-50/30 transition-colors">
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {venda.neighborhood || "N/A"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Unidade: {venda.unit || "S/N"} | Cód: {venda.propertyCode || "N/A"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(venda.saleDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {venda.clientName || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Share2 className="h-3 w-3 text-muted-foreground" />
                        {venda.originChannel || "Direto"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {venda.sellingBrokerId || "N/A"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-indigo-600">{formatCurrency(venda.commissionValue)}</span>
                        <span className="text-[10px] text-muted-foreground">{venda.commissionPercent ? `${venda.commissionPercent}%` : ""}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-emerald-600">
                      <div className="flex items-center justify-end gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {formatCurrency(venda.closedValue)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-24 text-center space-y-3 bg-muted/5">
            <BadgeCheck className="h-14 w-14 text-muted-foreground/10 mx-auto" />
            <div className="space-y-1">
              <p className="text-muted-foreground font-semibold">Nenhuma venda sincronizada ainda.</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                Sincronize sua aba <b>Conclusão de negócios</b> para popular esta lista.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
