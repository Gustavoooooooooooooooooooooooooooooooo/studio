"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface ChannelPerformanceProps {
  leads: any[];
}

export function ChannelPerformance({ leads }: ChannelPerformanceProps) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const parseDate = (d: any) => {
    if (!d) return null;
    if (typeof d === 'string') {
      const parts = d.split('/');
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2]);
        return new Date(year, Number(parts[1]) - 1, Number(parts[0]));
      }
      // Suporte para números seriais do Excel
      let val = d.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(val);
      if (!isNaN(num) && num > 40000 && num < 60000) {
        return new Date(Math.round((num - 25569) * 86400 * 1000));
      }
      return new Date(d);
    }
    return null;
  };

  const matrix = useMemo(() => {
    const data: Record<string, number[]> = {};
    const currentYear = 2026; // Fixado conforme regra do app

    leads.forEach(lead => {
      // Busca especificamente pela coluna "Fonte"
      const keys = Object.keys(lead);
      const sourceKey = keys.find(k => normalize(k) === "fonte" || normalize(k).includes("fonte"));
      const channel = sourceKey ? String(lead[sourceKey]).trim() : "Outros";

      if (channel && channel !== "undefined" && channel !== "null" && channel !== "") {
        if (!data[channel]) data[channel] = new Array(12).fill(0);
        
        // Identifica a data para colocar no mês correto
        const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo"));
        const date = dateKey ? parseDate(lead[dateKey]) : null;

        if (date && date.getFullYear() === currentYear) {
          const monthIndex = date.getMonth();
          data[channel][monthIndex] += 1;
        }
      }
    });

    return Object.entries(data)
      .map(([name, counts]) => ({ 
        name, 
        counts, 
        total: counts.reduce((a, b) => a + b, 0) 
      }))
      .sort((a, b) => b.total - a.total);
  }, [leads]);

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <CardHeader className="bg-muted/5 border-b">
        <CardTitle className="text-lg font-bold">Leads por Canal: Matriz Mensal (2026)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {matrix.length > 0 ? (
          <ScrollArea className="w-full">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="min-w-[140px] font-bold text-xs uppercase">Canal (Fonte)</TableHead>
                  {months.map(m => (
                    <TableHead key={m} className="text-center text-[10px] px-2 font-bold">{m}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold bg-muted/20 text-xs">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((row) => (
                  <TableRow key={row.name} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="font-semibold text-xs py-3">{row.name}</TableCell>
                    {row.counts.map((val, i) => (
                      <TableCell key={i} className={`text-center text-xs ${val === 0 ? 'text-muted-foreground/20' : 'font-medium text-primary'}`}>
                        {val === 0 ? '-' : val}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold text-xs bg-muted/5 text-primary">
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                        {row.total}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Nenhum dado de lead sincronizado para 2026.</p>
            <p className="text-[10px] text-muted-foreground/60 max-w-xs px-6">
              Vá na aba "Leads", cole o link da planilha e clique em Sincronizar para popular esta tabela.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
