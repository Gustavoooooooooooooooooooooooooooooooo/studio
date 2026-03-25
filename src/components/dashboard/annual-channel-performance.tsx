

"use client"

import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TrendingUp } from "lucide-react";

interface AnnualChannelPerformanceProps {
  sales: any[];
  selectedYears: string[];
}

export function AnnualChannelPerformance({ sales, selectedYears }: AnnualChannelPerformanceProps) {
  const normalize = useCallback((s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), []);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const getMappedChannel = useCallback((rawChannel: any): string => {
    const original = String(rawChannel || "").trim();
    if (!original) return "Direto/Indicação";

    const normalized = normalize(original);

    // Mappings
    if (['facebook', 'instagram', 'meta'].some(term => normalized.includes(term))) return 'Meta';
    if (normalized.includes('zap')) return 'Grupo Zap';
    if (normalized.includes('imovel web') || normalized.includes('imovelweb')) return 'Imóvel Web';
    if (normalized.includes('chaves na mao') || normalized.includes('chave na mao')) return 'Chaves na Mão';
    if (normalized.includes('google')) return 'Google';
    if (normalized.includes('site')) return 'Site';
    if (normalized.includes('pdv')) return 'PDV';
    if (normalized.includes('indicacao') || normalized.includes('relacionamento')) return 'Indicação/Relacionamento';
    if (normalized.includes('direto')) return 'Direto/Indicação';

    // Capitalize for consistency if no mapping found
    return original
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [normalize]);

  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) return d;
    
    if (typeof d === 'string') {
      const cleanStr = d.trim();
      // Handle DD/MM/YYYY format
      const parts = cleanStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const yearPart = parts[2].trim();
        const year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
      
      // Handle Excel date number format
      let val = cleanStr.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(val);
      if (!isNaN(num) && num > 40000 && num < 60000) {
        return new Date(Math.round((num - 25569) * 86400 * 1000));
      }

      // Fallback for ISO-like and other formats
      const date = new Date(cleanStr);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  const yearToDisplay = useMemo(() => selectedYears.length > 0 ? parseInt(selectedYears[0], 10) : new Date().getFullYear(), [selectedYears]);

  const monthlyData = useMemo(() => {
    const allChannels = Array.from(new Set(sales.map(sale => getMappedChannel(sale.origem || ''))))
          .filter(c => c && c.toLowerCase() !== 'n/a' && c !== "undefined" && c !== "null" && c !== "")
          .sort();
    
    const data: Record<string, { 
        vendas: number[], 
        locacoes: number[],
    }> = {};

    allChannels.forEach(channel => {
      data[channel] = {
        vendas: Array(12).fill(0),
        locacoes: Array(12).fill(0),
      };
    });

    sales.forEach(sale => {
      const date = parseDate(sale.saleDate);
      if (!date || date.getFullYear() !== yearToDisplay) return;

      const channel = getMappedChannel(sale.origem || '');
      if (!data[channel]) return;

      const month = date.getMonth();
      const tipo = normalize(sale.tipo || '');
      
      if (tipo === 'venda') {
        data[channel].vendas[month]++;
      } else if (tipo.includes('loca') || tipo.includes('aluguel')) {
        data[channel].locacoes[month]++;
      }
    });

    const rows = allChannels.map(channel => ({
      channel,
      vendas: data[channel].vendas,
      locacoes: data[channel].locacoes,
      totalVendas: data[channel].vendas.reduce((a, b) => a + b, 0),
      totalLocacoes: data[channel].locacoes.reduce((a, b) => a + b, 0),
    })).filter(r => (r.totalVendas + r.totalLocacoes) > 0);

    const monthlyTotals = {
        vendas: Array(12).fill(0),
        locacoes: Array(12).fill(0),
    };
    rows.forEach(row => {
        row.vendas.forEach((v, i) => monthlyTotals.vendas[i] += v);
        row.locacoes.forEach((l, i) => monthlyTotals.locacoes[i] += l);
    });

    const grandTotalVendas = monthlyTotals.vendas.reduce((a, b) => a + b, 0);
    const grandTotalLocacoes = monthlyTotals.locacoes.reduce((a, b) => a + b, 0);

    return { rows, monthlyTotals, grandTotalVendas, grandTotalLocacoes };
  }, [sales, yearToDisplay, getMappedChannel, normalize]);


  if (monthlyData.rows.length === 0) {
    return null; // Or a placeholder
  }
  
  const { rows, monthlyTotals, grandTotalVendas, grandTotalLocacoes } = monthlyData;

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Negócios Fechados por Canal ({yearToDisplay})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
            <ScrollArea className="w-full">
                <div className="min-w-[1040px]">
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
                            {rows.map(row => (
                                <TableRow key={row.channel} className="hover:bg-muted/5 transition-colors">
                                    <TableCell className="py-2 px-2 sticky left-0 bg-white z-10 border-r">
                                        <span className="font-semibold text-[10px] truncate leading-tight block">{row.channel}</span>
                                    </TableCell>
                                    {months.map((_, i) => (
                                        <TableCell key={i} className="text-center text-[10px] py-1 px-1 border-r">
                                            <div className="flex flex-col items-center leading-[1.1]">
                                                <span className={`${row.vendas[i] > 0 ? 'text-emerald-600 font-bold' : 'text-muted-foreground/20'}`}>
                                                    {row.vendas[i]}
                                                </span>
                                                <div className="h-[1px] w-4 bg-muted/20 my-0.5" />
                                                <span className={`${row.locacoes[i] > 0 ? 'text-blue-600 font-bold' : 'text-muted-foreground/20'}`}>
                                                    {row.locacoes[i]}
                                                </span>
                                            </div>
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right py-1 px-2 bg-muted/5 sticky right-0 z-10 border-l">
                                        <div className="flex flex-col items-end leading-[1.1]">
                                            <span className="text-emerald-600 font-bold text-[10px]">{row.totalVendas}</span>
                                            <div className="h-[1px] w-4 bg-muted/20 my-0.5" />
                                            <span className="text-blue-600 font-bold text-[10px]">{row.totalLocacoes}</span>
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
                                    <span className="text-emerald-600 font-extrabold text-[10px]">{monthlyTotals.vendas[i]}</span>
                                    <div className="h-[1px] w-4 bg-primary/10 my-0.5" />
                                    <span className="text-blue-600 font-extrabold text-[10px]">{monthlyTotals.locacoes[i]}</span>
                                    </div>
                                </TableCell>
                                ))}
                                <TableCell className="text-right py-1 px-2 bg-primary/10 sticky right-0 z-10">
                                <div className="flex flex-col items-end leading-[1.1]">
                                    <span className="text-emerald-600 font-extrabold text-[10px]">{grandTotalVendas}</span>
                                    <div className="h-[1px] w-4 bg-primary/10 my-0.5" />
                                    <span className="text-blue-600 font-extrabold text-[10px]">{grandTotalLocacoes}</span>
                                </div>
                                </TableCell>
                            </TableRow>
                            <TableRow className="bg-primary/10">
                                <TableCell className="font-bold text-[10px] py-2 px-2 sticky left-0 bg-primary/10 z-10 border-r text-primary">
                                SOMA TOTAL
                                </TableCell>
                                {months.map((_, i) => (
                                <TableCell key={i} className="text-center py-2 px-1 border-r font-extrabold text-primary text-[11px]">
                                    {monthlyTotals.vendas[i] + monthlyTotals.locacoes[i]}
                                </TableCell>
                                ))}
                                <TableCell className="text-right py-2 px-2 bg-primary/20 sticky right-0 z-10 font-black text-primary text-[11px]">
                                {grandTotalVendas + grandTotalLocacoes}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </CardContent>
    </Card>
  );
}
