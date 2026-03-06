
"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users, AlertCircle } from "lucide-react";
import { useMemo } from "react";

const formatDateDisplay = (val: any) => {
  if (!val || val === "N/A" || String(val).trim() === "") return "-";
  const strVal = String(val).trim();
  if (!/\d/.test(strVal)) return strVal;

  if (strVal.match(/^\d{1,2}\.\d{1,2}\.\d{2,4}$/)) {
    return strVal.replace(/\./g, '/');
  }

  const cleanStr = strVal.replace(/[^\d]/g, '');
  const num = Number(cleanStr);
  if (!isNaN(num) && num > 40000 && num < 60000 && !strVal.includes('/') && !strVal.includes('.') && !strVal.includes('-')) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    return `${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${date.getUTCFullYear()}`;
  }
  return strVal;
};

interface LeadsDataTableProps {
  data: any[];
}

export function LeadsDataTable({ data }: LeadsDataTableProps) {
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    const allKeys = new Set<string>();
    data.slice(0, 50).forEach(lead => {
      Object.keys(lead).forEach(key => {
        if (key !== 'id') {
          allKeys.add(key);
        }
      });
    });
    return Array.from(allKeys);
  }, [data]);

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardHeader className="bg-indigo-50/50 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Base de Leads Espelhada (Consulta Viva)
          </CardTitle>
          <p className="text-xs text-muted-foreground">Atualização automática em tempo real via planilha.</p>
        </div>
        <Badge variant="outline" className="text-indigo-600 font-bold bg-white">
          {data.length} Registros
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {data.length > 0 ? (
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
                  {data.map((lead, idx) => (
                    <TableRow key={lead.id || idx} className="hover:bg-indigo-50/30 transition-colors border-b">
                      {columns.map((col) => (
                        <TableCell key={`${idx}-${col}`} className="text-xs py-3">
                          {lead[col] !== undefined && lead[col] !== null 
                            ? formatDateDisplay(lead[col]) 
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
                Insira o link da planilha acima para iniciar a consulta viva.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
