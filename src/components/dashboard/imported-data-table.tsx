
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Home, Calendar, User, MapPin, DollarSign, Tag } from "lucide-react";

export function ImportedDataTable() {
  const { firestore } = useFirebase();
  
  // Busca da coleção 'properties' que representa a Angariação/Estoque
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
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Gestão de Angariação (Estoque Real)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Lista dos últimos 50 imóveis captados. Exibindo valores de Venda e Locação sincronizados.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando estoque...</p>
          </div>
        ) : imoveis && imoveis.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[11px] font-bold uppercase">Cód. Imóvel</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Tipo</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Data Entrada</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Bairro / Local</TableHead>
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
                        <span className={`font-semibold ${imovel.listingType === 'Locação' ? 'text-accent' : 'text-primary'}`}>
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
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium">{imovel.neighborhood || "Não Inf."}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{imovel.address}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {imovel.brokerId || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-primary">
                      {formatCurrency(imovel.listingValue || 0)}
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
              Sincronize sua planilha Google Sheets acima para popular sua base de angariação.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
