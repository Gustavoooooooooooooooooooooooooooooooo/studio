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
    const currentYear = 2026;

    leads.forEach(lead => {
      const keys = Object.keys(lead);
      const sourceKey = keys.find(k => normalize(k) === "fonte" || normalize(k).includes("fonte"));
      const channel = sourceKey ? String(lead[sourceKey]).trim() : "Outros";

      if (channel && channel !== "undefined" && channel !== "null" && channel !== "") {
        if (!data[channel]) data[channel] = new Array(12).fill(0);
        
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
      <CardHeader className="bg-muted/5 border-b py-3">
        <CardTitle className="text-base font-bold text-primary">Matriz de Leads por Canal (2026)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {matrix.length > 0 ? (
          <ScrollArea className="w-full">
            <Table className="table-fixed w-full">
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[120px] font-bold text-[9px] uppercase sticky left-0 bg-muted/10 z-20 px-2">Canal (Fonte)</TableHead>
                  {months.map(m => (
                    <TableHead key={m} className="text-center text-[9px] px-1 font-bold w-[45px]">{m}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold bg-muted/20 text-[9px] sticky right-0 z-20 w-[60px] px-2">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((row) => (
                  <TableRow key={row.name} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="font-semibold text-[10px] py-2 px-2 sticky left-0 bg-white z-10 border-r truncate">
                      {row.name}
                    </TableCell>
                    {row.counts.map((val, i) => (
                      <TableCell key={i} className={`text-center text-[10px] py-2 px-1 border-r ${val === 0 ? 'text-muted-foreground/20' : 'font-medium text-primary'}`}>
                        {val === 0 ? '0' : val}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold text-[10px] py-2 px-2 bg-muted/5 text-primary sticky right-0 z-10 border-l">
                      {row.total}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Nenhum dado de lead sincronizado para 2026.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
