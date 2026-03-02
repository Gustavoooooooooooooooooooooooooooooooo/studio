
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Users } from "lucide-react";

export function LeadsDataTable() {
  const { firestore } = useFirebase();
  
  const leadsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "leads"),
      orderBy("importedAt", "desc"),
      limit(200)
    );
  }, [firestore]);

  const { data: leads, isLoading } = useCollection(leadsQuery);

  // Pega todas as chaves únicas presentes nos leads para montar os cabeçalhos dinamicamente
  const columns = leads && leads.length > 0 
    ? Object.keys(leads[0]).filter(k => k !== 'id' && k !== 'importedAt')
    : [];

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-indigo-50/50 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Base de Leads Sincronizada
          </CardTitle>
          <p className="text-xs text-muted-foreground">Exibindo todas as colunas espelhadas da sua planilha.</p>
        </div>
        <Badge variant="outline" className="text-indigo-600 font-bold">
          {leads?.length || 0} Registros
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm text-muted-foreground">Lendo dados...</p>
          </div>
        ) : leads && leads.length > 0 ? (
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="text-[10px] font-bold uppercase min-w-[150px] whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-indigo-50/30 transition-colors">
                      {columns.map((col) => (
                        <TableCell key={col} className="text-xs">
                          {String(lead[col] || "-")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="py-20 text-center text-muted-foreground">Sincronize os dados de Leads para visualizar a tabela completa.</div>
        )}
      </CardContent>
    </Card>
  );
}
