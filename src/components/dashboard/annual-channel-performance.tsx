
"use client"

import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TrendingUp } from "lucide-react";

interface AnnualChannelPerformanceProps {
  sales: any[];
}

export function AnnualChannelPerformance({ sales }: AnnualChannelPerformanceProps) {
  const normalize = useCallback((s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), []);

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

  const annualData = useMemo(() => {
    const dataByChannelYear: Record<string, Record<string, number>> = {};
    const years = new Set<string>();
    const channels = new Set<string>();

    sales.forEach(sale => {
      const date = parseDate(sale.saleDate);
      if (!date) return;

      const year = String(date.getFullYear());
      const channel = getMappedChannel(sale.origem || '');
      if (!channel || channel.toLowerCase() === 'n/a' || channel === "undefined" || channel === "null" || channel === "") return;

      years.add(year);
      channels.add(channel);

      if (!dataByChannelYear[channel]) {
        dataByChannelYear[channel] = {};
      }
      if (!dataByChannelYear[channel][year]) {
        dataByChannelYear[channel][year] = 0;
      }

      dataByChannelYear[channel][year]++;
    });

    const sortedYears = Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    const sortedChannels = Array.from(channels).sort();
    
    const tableRows = sortedChannels.map(channel => {
      const rowData: Record<string, number | string> = { channel };
      let total = 0;
      sortedYears.forEach(year => {
        const count = dataByChannelYear[channel][year] || 0;
        rowData[year] = count;
        total += count;
      });
      rowData['total'] = total;
      return rowData;
    });

    const yearlyTotals: Record<string, number> = {};
    let grandTotal = 0;
    sortedYears.forEach(year => {
        const yearTotal = sortedChannels.reduce((sum, channel) => sum + (dataByChannelYear[channel]?.[year] || 0), 0);
        yearlyTotals[year] = yearTotal;
        grandTotal += yearTotal;
    });


    return {
      years: sortedYears,
      rows: tableRows,
      totals: yearlyTotals,
      grandTotal: grandTotal,
    };
  }, [sales, getMappedChannel]);


  if (annualData.rows.length === 0) {
    return null; // Or a placeholder
  }

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
        <CardHeader className="bg-muted/5 border-b py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Negócios Fechados por Canal (Anual)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
            <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px] font-bold sticky left-0 bg-muted/10 z-10">Canal</TableHead>
                                {annualData.years.map(year => (
                                    <TableHead key={year} className="text-center font-bold">{year}</TableHead>
                                ))}
                                <TableHead className="text-center font-bold bg-muted/20">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {annualData.rows.map(row => (
                                <TableRow key={row.channel as string}>
                                    <TableCell className="font-semibold sticky left-0 bg-white z-10 border-r">{row.channel}</TableCell>
                                    {annualData.years.map(year => (
                                        <TableCell key={year} className={`text-center font-medium ${row[year] === 0 ? 'text-muted-foreground/30' : ''}`}>
                                            {row[year]}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-center font-bold bg-muted/10">{row.total}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-primary/5">
                                <TableCell className="font-bold sticky left-0 bg-primary/5 z-10 border-r">Total Anual</TableCell>
                                {annualData.years.map(year => (
                                    <TableCell key={year} className="text-center font-black text-primary">
                                        {annualData.totals[year]}
                                    </TableCell>
                                ))}
                                <TableCell className="text-center font-black text-primary bg-primary/10">
                                    {annualData.grandTotal}
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
