
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useMemo } from "react";

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

  const matrixData = useMemo(() => {
    const data: Record<string, number[]> = {};
    const currentYear = 2026;

    leads.forEach(lead => {
      const keys = Object.keys(lead);
      const sourceKey = keys.find(k => {
        const nk = normalize(k);
        return nk === "fonte" || nk.includes("fonte") || nk === "origem" || nk.includes("origem") || nk === "canal";
      });
      
      const channel = sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação";

      if (channel && channel !== "undefined" && channel !== "null" && channel !== "") {
        if (!data[channel]) data[channel] = new Array(12).fill(0);
        
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

    const rows = Object.entries(data)
      .map(([name, counts]) => ({ 
        name, 
        counts, 
        total: counts.reduce((a, b) => a + b, 0) 
      }))
      .filter(row => row.total > 0)
      .sort((a, b) => b.total - a.total);

    // Calcular Totais Mensais (Rodapé)
    const monthlyTotals = new Array(12).fill(0);
    let grandTotal = 0;

    rows.forEach(row => {
      row.counts.forEach((count, i) => {
        monthlyTotals[i] += count;
      });
      grandTotal += row.total;
    });

    return { rows, monthlyTotals, grandTotal };
  }, [leads]);

  const { rows, monthlyTotals, grandTotal } = matrixData;

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <CardHeader className="bg-muted/5 border-b py-3">
        <CardTitle className="text-base font-bold text-primary">Matriz de Leads por Canal (2026)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length > 0 ? (
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
                {rows.map((row) => (
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
              <TableFooter className="bg-primary/5 border-t-2 border-primary/20">
                <TableRow>
                  <TableCell className="font-bold text-[10px] py-2 px-2 sticky left-0 bg-primary/5 z-10 border-r">
                    TOTAL GERAL
                  </TableCell>
                  {monthlyTotals.map((val, i) => (
                    <TableCell key={i} className="text-center text-[10px] font-bold py-2 px-1 border-r text-primary">
                      {val}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold text-[11px] py-2 px-2 bg-primary text-white sticky right-0 z-10">
                    {grandTotal}
                  </TableCell>
                </TableRow>
              </TableFooter>
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
