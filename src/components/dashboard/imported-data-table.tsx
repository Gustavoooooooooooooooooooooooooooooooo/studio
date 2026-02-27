
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Home, Calendar, User, Tag } from "lucide-react";

export function ImportedDataTable() {
  const { firestore } = useFirebase();
  
  // Busca da coleção 'properties' que representa a Angariação/Estoque Real
  const angariacaoQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "properties"),
      orderBy("importedAt", "desc"),
      limit(50)
    );
  }, [firestore]);

  const { data: imoveis, isLoading } = useCollection(angariacaoQuery);

  const formatCurrency = (value: number) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Gestão de Angariação (Estoque Sincronizado)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Exibindo os últimos 50 imóveis capturados via Google Sheets.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Lendo banco de dados...</p>
          </div>
        ) : imoveis && imoveis.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[11px] font-bold uppercase">Código</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Tipo</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Data Entrada</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Bairro</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Angariador</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase">Valor Anúncio</TableHead>
                  <TableHead className="text-center text-[11px] font-bold uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imoveis.map((imovel) => (
                  <TableRow key={imovel.id} className="hover:bg-muted/5">
                    <TableCell className="font-bold text-xs text-primary">{imovel.propertyCode || "S/N"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <span className={`font-semibold ${imovel.listingType === 'Locação' ? 'text-cyan-600' : 'text-blue-600'}`}>
                          {imovel.listingType || "Venda"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {imovel.captureDate ? new Date(imovel.captureDate).toLocaleDateString('pt-BR') : "N/D"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {imovel.neighborhood || "Desconhecido"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {imovel.brokerId || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-primary">
                      {formatCurrency(imovel.listingValue)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={imovel.status === 'Vendido' ? 'secondary' : 'default'} 
                        className={`text-[9px] px-1.5 py-0 ${imovel.status === 'Vendido' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-500 text-white'}`}
                      >
                        {imovel.status || "Disponível"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-20 text-center space-y-2">
            <Home className="h-12 w-12 text-muted-foreground/20 mx-auto" />
            <p className="text-muted-foreground font-medium">Estoque vazio.</p>
            <p className="text-xs text-muted-foreground/60 px-10">
              Sincronize sua planilha Google Sheets para popular o estoque de Venda e Locação.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
