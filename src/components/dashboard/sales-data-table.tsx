
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BadgeCheck, Calendar, User, DollarSign, TrendingUp } from "lucide-react";

export function SalesDataTable() {
  const { firestore } = useFirebase();
  
  // Busca da coleção 'vendas_imoveis' que representa o Fechamento Real
  const vendasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "vendas_imoveis"),
      orderBy("saleDate", "desc"),
      limit(50)
    );
  }, [firestore]);

  const { data: vendas, isLoading } = useCollection(vendasQuery);

  const formatCurrency = (value: number) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-accent/5 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-accent" />
            Vendas Realizadas (Dados Sincronizados)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Visualização dos últimos 50 fechamentos importados da planilha.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Lendo registros de venda...</p>
          </div>
        ) : vendas && vendas.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[11px] font-bold uppercase">Imóvel</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Data Venda</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Cliente</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Corretor</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Canal</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase">Valor Fechado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((venda) => (
                  <TableRow key={venda.id} className="hover:bg-muted/5">
                    <TableCell className="font-bold text-xs text-accent">{venda.propertyId || "S/N"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {venda.saleDate ? new Date(venda.saleDate).toLocaleDateString('pt-BR') : "N/D"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {venda.clientName || "N/A"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {venda.sellingBrokerId || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                       <Badge variant="outline" className="text-[9px] px-1 py-0">{venda.originChannel || "Planilha"}</Badge>
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
          <div className="py-20 text-center space-y-2">
            <BadgeCheck className="h-12 w-12 text-muted-foreground/20 mx-auto" />
            <p className="text-muted-foreground font-medium">Nenhuma venda sincronizada.</p>
            <p className="text-xs text-muted-foreground/60 px-10">
              Sincronize sua planilha de vendas para ver os resultados financeiros aqui.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
