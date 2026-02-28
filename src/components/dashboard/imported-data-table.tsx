
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Home, Calendar, User, MapPin, Table2 } from "lucide-react";

export function ImportedDataTable() {
  const { firestore } = useFirebase();
  
  const angariacaoQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "properties"),
      orderBy("importedAt", "desc"),
      limit(200)
    );
  }, [firestore]);

  const { data: imoveis, isLoading } = useCollection(angariacaoQuery);

  const formatCurrency = (value: number) => {
    if (!value) return "R$ 0,00";
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
            Planilha de Cadastro (Estoque)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Exibindo os dados capturados da sua planilha de Angariação.
          </p>
        </div>
        <Badge variant="outline" className="font-bold text-primary">
          {imoveis?.length || 0} Imóveis
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Lendo banco de dados...</p>
          </div>
        ) : imoveis && imoveis.length > 0 ? (
          <ScrollArea className="w-full">
            <div className="min-w-[1500px]">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Data Cadastro</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px]">Código</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Angariador</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Bairro</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[300px]">Endereço</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px]">Tipo</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase min-w-[150px]">Valor Anúncio</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[120px]">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase min-w-[150px]">Última Importação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imoveis.map((imovel) => (
                    <TableRow key={imovel.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {imovel.captureDate || "S/D"}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-xs text-primary">{imovel.propertyCode || "S/N"}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {imovel.brokerId || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        {imovel.neighborhood || "Desconhecido"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {imovel.address || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/5">
                          {imovel.listingType || "Venda"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-primary">
                        {formatCurrency(imovel.listingValue)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600">
                          {imovel.status || "Disponível"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {imovel.importedAt ? new Date(imovel.importedAt.seconds * 1000).toLocaleString('pt-BR') : "Processando..."}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="py-20 text-center space-y-2">
            <Home className="h-12 w-12 text-muted-foreground/20 mx-auto" />
            <p className="text-muted-foreground font-medium">Estoque vazio.</p>
            <p className="text-xs text-muted-foreground/60 px-10">
              Clique em sincronizar para preencher esta lista.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
