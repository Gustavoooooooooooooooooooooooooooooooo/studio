
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BadgeCheck, Calendar, User, TrendingUp, Tag } from "lucide-react";

export function SalesDataTable() {
  const { firestore } = useFirebase();
  
  // Busca em tempo real da coleção 'vendas_imoveis'
  // Removi o orderBy saleDate para garantir que apareça mesmo que o campo esteja instável, 
  // mas o ideal é manter por importedAt para ver o resultado da sincronização.
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
            Vendas e Fechamentos Reais
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Lista de fechamentos financeiros processados da sua planilha.
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
                  <TableHead className="text-[11px] font-bold uppercase">Imóvel</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Tipo</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Data Venda</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Cliente</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Corretor</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase">Valor Fechado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.map((venda) => (
                  <TableRow key={venda.id} className="hover:bg-emerald-50/30 transition-colors">
                    <TableCell className="font-bold text-xs text-emerald-700">{venda.propertyId || "S/N"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-muted-foreground">{venda.listingType || "Venda"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(venda.saleDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {venda.clientName || "N/A"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {venda.sellingBrokerId || "N/A"}
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
                Certifique-se de que sua planilha tem uma coluna identificada como <b>Data Venda</b> ou <b>Fechamento</b> para os registros aparecerem aqui.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
