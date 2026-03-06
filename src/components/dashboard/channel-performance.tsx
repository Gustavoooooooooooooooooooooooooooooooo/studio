
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
      const parts = cleanStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const yearPart = parts[2].trim();
        const year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
      
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
    const data: Record<string, { venda: number[], locacao: number[] }> = {};
    const currentYear = new Date().getFullYear();

    leads.forEach(lead => {
      const keys = Object.keys(lead);
      
      const sourceKey = keys.find(k => {
        const nk = normalize(k);
        return nk === "fonte" || nk.includes("fonte") || nk === "origem" || nk.includes("origem") || nk === "canal";
      });
      const channel = sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação";

      const natureKey = keys.find(k => {
        const nk = normalize(k);
        return nk.includes("natureza") || nk.includes("negociacao");
      });
      
      let isLocacao = false;
      if (natureKey && lead[natureKey]) {
        const nVal = normalize(lead[natureKey]);
        if (nVal.includes("loca") || nVal.includes("alug")) isLocacao = true;
      }

      if (channel && channel !== "undefined" && channel !== "null" && channel !== "") {
        if (!data[channel]) {
          data[channel] = {
            venda: new Array(12).fill(0),
            locacao: new Array(12).fill(0)
          };
        }
        
        const dateKey = keys.find(k => {
          const nk = normalize(k);
          return nk.includes("data") || nk.includes("carimbo") || nk.includes("criado");
        });
        
        const date = dateKey ? parseDate(lead[dateKey]) : null;

        if (date && date.getFullYear() === currentYear) {
          const m = date.getMonth();
          if (isLocacao) data[channel].locacao[m]++;
          else data[channel].venda[m]++;
        }
      }
    });

    const rows = Object.entries(data).map(([channel, counts]) => ({
      channel,
      venda: counts.venda,
      locacao: counts.locacao,
      totalVenda: counts.venda.reduce((a, b) => a + b, 0),
      totalLocacao: counts.locacao.reduce((a, b) => a + b, 0)
    })).filter(r => (r.totalVenda + r.totalLocacao) > 0);

    rows.sort((a, b) => a.channel.localeCompare(b.channel));

    const monthlyTotals = {
      venda: new Array(12).fill(0),
      locacao: new Array(12).fill(0)
    };
    
    rows.forEach(row => {
      row.venda.forEach((v, i) => monthlyTotals.venda[i] += v);
      row.locacao.forEach((l, i) => monthlyTotals.locacao[i] += l);
    });

    const grandTotalVenda = rows.reduce((acc, r) => acc + r.totalVenda, 0);
    const grandTotalLocacao = rows.reduce((acc, r) => acc + r.totalLocacao, 0);

    return { rows, monthlyTotals, grandTotalVenda, grandTotalLocacao };
  }, [leads]);

  const { rows, monthlyTotals, grandTotalVenda, grandTotalLocacao } = matrixData;

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <CardHeader className="bg-muted/5 border-b py-3">
        <CardTitle className="text-base font-bold text-primary">Matriz de Leads por Canal ({new Date().getFullYear()})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length > 0 ? (
          <ScrollArea className="w-full">
            <Table className="table-fixed w-full">
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[140px] font-bold text-[9px] uppercase sticky left-0 bg-muted/10 z-20 px-2">Canal</TableHead>
                  {months.map(m => (
                    <TableHead key={m} className="text-center text-[9px] px-1 font-bold w-[45px]">{m}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold bg-muted/20 text-[9px] sticky right-0 z-20 w-[60px] px-2">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.channel} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="py-2 px-2 sticky left-0 bg-white z-10 border-r">
                      <span className="font-semibold text-[10px] truncate leading-tight block">{row.channel}</span>
                    </TableCell>
                    {months.map((_, i) => (
                      <TableCell key={i} className="text-center text-[10px] py-1 px-1 border-r">
                        <div className="flex flex-col items-center leading-[1.1]">
                          <span className={`${row.venda[i] > 0 ? 'text-emerald-600 font-bold' : 'text-muted-foreground/20'}`}>
                            {row.venda[i]}
                          </span>
                          <div className="h-[1px] w-4 bg-muted/20 my-0.5" />
                          <span className={`${row.locacao[i] > 0 ? 'text-blue-600 font-bold' : 'text-muted-foreground/20'}`}>
                            {row.locacao[i]}
                          </span>
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="text-right py-1 px-2 bg-muted/5 sticky right-0 z-10 border-l">
                      <div className="flex flex-col items-end leading-[1.1]">
                        <span className="text-emerald-600 font-bold text-[10px]">{row.totalVenda}</span>
                        <div className="h-[1px] w-4 bg-muted/20 my-0.5" />
                        <span className="text-blue-600 font-bold text-[10px]">{row.totalLocacao}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-primary/5 border-t-2 border-primary/20">
                <TableRow className="border-b border-primary/10">
                  <TableCell className="font-bold text-[10px] py-2 px-2 sticky left-0 bg-primary/5 z-10 border-r text-muted-foreground">
                    POR NATUREZA
                  </TableCell>
                  {months.map((_, i) => (
                    <TableCell key={i} className="text-center py-1 px-1 border-r">
                      <div className="flex flex-col items-center leading-[1.1]">
                        <span className="text-emerald-600 font-extrabold text-[10px]">{monthlyTotals.venda[i]}</span>
                        <div className="h-[1px] w-4 bg-primary/10 my-0.5" />
                        <span className="text-blue-600 font-extrabold text-[10px]">{monthlyTotals.locacao[i]}</span>
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="text-right py-1 px-2 bg-primary/10 sticky right-0 z-10">
                    <div className="flex flex-col items-end leading-[1.1]">
                      <span className="text-emerald-600 font-extrabold text-[10px]">{grandTotalVenda}</span>
                      <div className="h-[1px] w-4 bg-primary/10 my-0.5" />
                      <span className="text-blue-600 font-extrabold text-[10px]">{grandTotalLocacao}</span>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow className="bg-primary/10">
                  <TableCell className="font-bold text-[10px] py-2 px-2 sticky left-0 bg-primary/10 z-10 border-r text-primary">
                    SOMA TOTAL
                  </TableCell>
                  {months.map((_, i) => (
                    <TableCell key={i} className="text-center py-2 px-1 border-r font-extrabold text-primary text-[11px]">
                      {monthlyTotals.venda[i] + monthlyTotals.locacao[i]}
                    </TableCell>
                  ))}
                  <TableCell className="text-right py-2 px-2 bg-primary/20 sticky right-0 z-10 font-black text-primary text-[11px]">
                    {grandTotalVenda + grandTotalLocacao}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Nenhum dado de lead sincronizado para {new Date().getFullYear()}.</p>
            <p className="text-[10px] text-muted-foreground/60 max-w-xs mx-auto">Verifique as colunas "Fonte", "Natureza da Negociação" e "Data" na sua planilha.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
