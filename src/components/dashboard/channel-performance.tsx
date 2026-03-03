
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
    if (d instanceof Date) return d;
    
    if (typeof d === 'string') {
      const cleanStr = d.trim();
      // Suporte DD/MM/AAAA
      const parts = cleanStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const yearPart = parts[2].trim();
        const year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
      
      // Suporte Serial Excel
      let val = cleanStr.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(val);
      if (!isNaN(num) && num > 40000 && num < 60000) {
        return new Date(Math.round((num - 25569) * 86400 * 1000));
      }

      const date = new Date(cleanStr);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  const matrix = useMemo(() => {
    const data: Record<string, number[]> = {};
    const currentYear = 2026; // Fixado conforme os dados da Canto Imóveis

    leads.forEach(lead => {
      const keys = Object.keys(lead);
      // Busca agressiva pela coluna de Canal/Fonte/Origem
      const sourceKey = keys.find(k => {
        const nk = normalize(k);
        return nk === "fonte" || nk.includes("fonte") || nk === "origem" || nk.includes("origem") || nk === "canal";
      });
      
      const channel = sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação";

      if (channel && channel !== "undefined" && channel !== "null" && channel !== "") {
        if (!data[channel]) data[channel] = new Array(12).fill(0);
        
        // Busca agressiva pela coluna de Data
        const dateKey = keys.find(k => {
          const nk = normalize(k);
          return nk.includes("data") || nk.includes("carimbo") || nk.includes("criado");
        });
        
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
      .filter(row => row.total > 0) // Mostra apenas canais com leads no período
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
                      <TableCell key={i} className={`text-center text-[10px] py-2 px-1 border-r ${val === 0 ? 'text-muted-foreground/10' : 'font-medium text-primary'}`}>
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
            <p className="text-[10px] text-muted-foreground/60 max-w-xs mx-auto">Verifique se as colunas "Fonte" e "Data" estão presentes na sua planilha de Leads.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
