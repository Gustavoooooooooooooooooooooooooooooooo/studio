
"use client"

import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Users, AlertCircle } from "lucide-react";
import { useMemo } from "react";

export function LeadsDataTable() {
  const { firestore, user } = useFirebase();
  
  const leadsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "leads")
    );
  }, [firestore, user]);

  const { data: leads, isLoading } = useCollection(leadsQuery);

  const columns = useMemo(() => {
    if (!leads || leads.length === 0) return [];
    
    const allKeys = new Set<string>();
    leads.slice(0, 50).forEach(lead => {
      Object.keys(lead).forEach(key => {
        if (key !== 'id' && key !== 'importedAt') {
          allKeys.add(key);
        }
      });
    });
    
    return Array.from(allKeys);
  }, [leads]);

  // Função auxiliar de tratamento de data para a tabela
  const formatDateValue = (val: any) => {
    if (!val || val === "N/A" || String(val).trim() === "") return "-";
    const strVal = String(val).trim();
    // Se parecer uma data com pontos, converte para barra para exibição
    if (strVal.match(/^\d{1,2}\.\d{1,2}\.\d{2,4}$/)) return strVal.replace(/\./g, '/');
    return strVal;
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-indigo-50/50 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Base de Leads Espelhada
          </CardTitle>
          <p className="text-xs text-muted-foreground">Sincronização automática ativa (atualiza toda vez que você muda a planilha).</p>
        </div>
        <Badge variant="outline" className="text-indigo-600 font-bold bg-white">
          {leads?.length || 0} Registros
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm text-muted-foreground font-medium">Sincronizando Leads...</p>
          </div>
        ) : leads && leads.length > 0 ? (
          <ScrollArea className="w-full h-[600px]">
            <div className="min-w-max">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="text-[10px] font-bold uppercase min-w-[180px] whitespace-nowrap bg-muted/30">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-indigo-50/30 transition-colors border-b">
                      {columns.map((col) => (
                        <TableCell key={`${lead.id}-${col}`} className="text-xs py-3">
                          {lead[col] !== undefined && lead[col] !== null 
                            ? formatDateValue(lead[col]) 
                            : "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        ) : (
          <div className="py-32 text-center space-y-4">
            <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-indigo-300" />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground font-bold text-lg">Nenhum lead espelhado</p>
              <p className="text-sm text-muted-foreground/60 max-w-sm mx-auto">
                Ative a sincronização automática acima para puxar os dados da sua planilha.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
