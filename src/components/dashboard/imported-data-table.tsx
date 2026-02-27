"use client"

import { useMemo } from "react";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Calendar, User, MapPin } from "lucide-react";

export function ImportedDataTable() {
  const { firestore } = useFirestore() ? { firestore: useFirestore() } : { firestore: null };
  
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
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Dados Sincronizados (Últimos 50)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Visualização em tempo real dos registros presentes no banco de dados.
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
                    <TableCell className="font-semibold text-xs">{venda.propertyId}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(venda.saleDate).toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {venda.neighborhood}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-primary">{venda.sellingBrokerId}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {venda.clientName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-emerald-600">
                      {formatCurrency(venda.closedValue)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {venda.originChannel}
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
            <p className="text-muted-foreground">Nenhum dado encontrado no banco de dados.</p>
            <p className="text-xs text-muted-foreground/60">Utilize a conexão com o Google Sheets acima para importar dados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
