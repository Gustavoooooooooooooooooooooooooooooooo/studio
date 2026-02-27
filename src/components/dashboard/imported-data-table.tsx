
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Calendar, User, MapPin } from "lucide-react";

export function ImportedDataTable() {
  const { firestore } = useFirebase();
  
  const vendasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "vendas_imoveis"),
      orderBy("importedAt", "desc"),
      limit(50)
    );
  }, [firestore]);

  const { data: vendas, isLoading } = useCollection(vendasQuery);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Dados no Banco de Dados (Últimos 50)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Estes são os dados reais que estão alimentando o Dashboard.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando registros...</p>
          </div>
        ) : vendas && vendas.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[11px] font-bold uppercase">Imóvel</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Data Venda</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Bairro</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Corretor</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Cliente</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase">Valor Fechado</TableHead>
                  <TableHead className="text-center text-[11px] font-bold uppercase">Canal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((venda) => (
                  <TableRow key={venda.id} className="hover:bg-muted/5">
                    <TableCell className="font-semibold text-xs">{venda.propertyId || "S/N"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {venda.saleDate ? new Date(venda.saleDate).toLocaleDateString('pt-BR') : "N/D"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {venda.neighborhood || "Não Inf."}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-primary">{venda.sellingBrokerId || "N/A"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {venda.clientName || "Cliente"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-emerald-600">
                      {formatCurrency(venda.closedValue || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {venda.originChannel || "Planilha"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-20 text-center space-y-2">
            <Database className="h-12 w-12 text-muted-foreground/20 mx-auto" />
            <p className="text-muted-foreground">Nenhum dado real encontrado.</p>
            <p className="text-xs text-muted-foreground/60">Use a limpeza e sincronize sua planilha para ver seus dados aqui.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
