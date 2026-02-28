
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, BadgeCheck } from "lucide-react";

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

  const formatCurrency = (value: any) => {
    const num = Number(value);
    if (isNaN(num) || !num) return "R$ 0,00";
    // Usamos Intl.NumberFormat para formatar moedas no padrão brasileiro corretamente
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
          <p className="text-xs text-muted-foreground">Exibindo todas as colunas capturadas da planilha Google.</p>
        </div>
        <Badge variant="outline" className="text-emerald-600 font-bold">
          {vendas?.length || 0} Registros
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm text-muted-foreground">Lendo dados da planilha...</p>
          </div>
        ) : vendas && vendas.length > 0 ? (
          <ScrollArea className="w-full">
            <div className="min-w-[2500px]">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Data Venda</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Vendedor</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Tipo Venda</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Angariador</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px]">Cód Imóvel</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Imobiliária/Corretor</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px] text-right">% Canto</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Construtora</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[200px]">Empreendimento</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[100px]">Unidade</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[200px]">Nome Contrato</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Telefone</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">E-mail</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Origem Lead</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px] text-right">Valor Anúncio</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px] text-right">Valor Venda</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px] text-right">Comissão Canto</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Carimbo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendas.map((venda) => (
                    <TableRow key={venda.id} className="hover:bg-emerald-50/30 transition-colors">
                      <TableCell className="text-xs font-bold text-emerald-700">{venda.saleDate || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.vendedor || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.tipoVenda || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.angariador || "N/A"}</TableCell>
                      <TableCell className="text-xs font-mono">{venda.propertyCode || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.imobiliariaCorretor || "N/A"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{venda.percentualCanto ? `${venda.percentualCanto}%` : "-"}</TableCell>
                      <TableCell className="text-xs">{venda.construtora || "N/A"}</TableCell>
                      <TableCell className="text-xs font-semibold">{venda.neighborhood || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.unit || "N/A"}</TableCell>
                      <TableCell className="text-xs font-bold">{venda.clientName || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.telefone || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.email || "N/A"}</TableCell>
                      <TableCell className="text-xs">{venda.originChannel || "N/A"}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">{formatCurrency(venda.advertisedValue)}</TableCell>
                      <TableCell className="text-xs text-right font-bold text-emerald-600">{formatCurrency(venda.closedValue)}</TableCell>
                      <TableCell className="text-xs text-right font-bold text-indigo-600">{formatCurrency(venda.commissionValue)}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{venda.timestamp || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="py-20 text-center text-muted-foreground">Sincronize a aba Conclusão para ver os dados aqui.</div>
        )}
      </CardContent>
    </Card>
  );
}
