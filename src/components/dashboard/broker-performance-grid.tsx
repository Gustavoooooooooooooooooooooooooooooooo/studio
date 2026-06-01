
"use client";

import { useMemo, useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface BrokerPerformanceGridProps {
  sales: any[];
  leads: any[];
  properties: any[];
  selectedMonths: string[];
  selectedYears: string[];
  brokers: string[];
}

export function BrokerPerformanceGrid({ sales, leads, properties, selectedMonths, selectedYears, brokers }: BrokerPerformanceGridProps) {
  const [performanceView, setPerformanceView] = useState<'venda' | 'locacao' | 'metricas'>('venda');

  const normalize = useCallback((s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), []);

  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) {
        if (isNaN(d.getTime())) return null;
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }

    const strVal = String(d).trim();
    if (!strVal || ["n/a", "undefined", "null", ""].includes(strVal.toLowerCase())) return null;

    const dmyMatch = strVal.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;
      if (day > 0 && day <= 31 && month >= 0 && month < 12) {
        const date = new Date(Date.UTC(year, month, day));
        if (!isNaN(date.getTime())) return date;
      }
    }

    const isoMatch = strVal.match(/^(\d{4})[.\/-](\d{2})[.\/-](\d{2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        if (day > 0 && day <= 31 && month >= 0 && month < 12) {
            const date = new Date(Date.UTC(year, month, day));
            if (!isNaN(date.getTime())) return date;
        }
    }
    
    if (/^\d{5}$/.test(strVal)) {
        const num = Number(strVal);
        if (!isNaN(num) && num > 30000 && num < 70000) {
            const excelEpoch = Date.UTC(1899, 11, 30);
            const date = new Date(excelEpoch + num * 86400000);
            if (!isNaN(date.getTime())) return date;
        }
    }

    const nativeDate = new Date(strVal);
    if (!isNaN(nativeDate.getTime())) {
        const utcDate = new Date(Date.UTC(nativeDate.getFullYear(), nativeDate.getMonth(), nativeDate.getDate()));
        if (!isNaN(utcDate.getTime())) return utcDate;
    }

    return null;
  };

  const { stats, totals } = useMemo(() => {
    if (!brokers || brokers.length === 0) return { stats: [], totals: null };

    const totalDaysCount = 427; 

    const filterByPeriod = (item: any, dateField: string) => {
        const d = parseDate(item[dateField]);
        if (!d) return false;
        const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(String(d.getUTCMonth()));
        const yearMatch = selectedYears.length === 0 || selectedYears.includes(String(d.getUTCFullYear()));
        return monthMatch && yearMatch;
    };

    const isMatchStrict = (sheetValue: string | undefined | null, brokerName: string) => {
        if (!sheetValue || sheetValue === "N/A") return false;
        const nSheet = normalize(String(sheetValue));
        const nBroker = normalize(brokerName);
        if (nSheet === "lancamento") return false;
        
        const brokerWords = nBroker.split(' ');
        const sheetWords = nSheet.split(/[\s\/,.-]+/);
        return brokerWords.every(bw => sheetWords.includes(bw));
    };

    const allSalesInPeriod = sales.filter(s => {
        const isSaleType = !normalize(s.tipo || '').includes('loca') && !normalize(s.tipo || '').includes('aluguel');
        if (!isSaleType) return false;
        return filterByPeriod(s, 'saleDate');
    });
    
    // VGV total das vendas REAIS ÚNICAS realizadas no período
    const uniqueSalesInPeriod = allSalesInPeriod.filter(sale => 
        brokers.some(broker => isMatchStrict(sale.angariador, broker)) || 
        brokers.some(broker => isMatchStrict(sale.vendedor, broker))
    );
    const totalVgvInPeriod = uniqueSalesInPeriod.reduce((acc, s) => acc + (s.closedValue || 0), 0);

    const brokerStats = brokers.map(brokerName => {
      const bPropsFiltered = properties.filter(p => {
        const brokerField = p.brokerId || p.angariador || p.captador;
        if (!isMatchStrict(brokerField, brokerName)) return false;
        return filterByPeriod(p, 'captureDate');
      });
      
      const capturesSale = bPropsFiltered.filter(p => p.saleValue && Number(p.saleValue) > 0).length;
      const capturesRent = bPropsFiltered.filter(p => p.rentalValue && Number(p.rentalValue) > 0).length;
      const vgvAngariadoNoEstoque = bPropsFiltered.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0);
      const vglAngariadoNoEstoque = bPropsFiltered.reduce((acc, p) => acc + (Number(p.rentalValue) || 0), 0);

      const brokerLeadsFiltered = leads.filter(l => {
        if (!l) return false;
        const keys = Object.keys(l);
        const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo"));
        if (dateKey && !filterByPeriod(l, dateKey)) return false;

        return Object.entries(l).some(([key, val]) => {
          const nk = normalize(key);
          const isBrokerColumn = nk.includes("corretor") || nk.includes("responsavel") || nk.includes("atendente") || nk.includes("vendedor");
          return isBrokerColumn && isMatchStrict(String(val || ""), brokerName);
        });
      });

      const { leadsVenda, leadsLocacao, visitsVenda, visitsLocacao } = brokerLeadsFiltered.reduce((acc, l) => {
        const entries = Object.entries(l);
        const normalizeVal = (v: any) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        const isLocacaoLead = entries.some(([key, val]) => {
            const nk = normalize(key);
            const nv = normalizeVal(val);
            return (nk.includes("natureza") || nk.includes("negociacao") || nk === "tipo") && 
                   (nv.includes("loca") || nv.includes("alug"));
        });
        
        if (isLocacaoLead) acc.leadsLocacao++; else acc.leadsVenda++;

        const hasVisit = entries.some(([key, val]) => {
          const nk = normalize(key);
          const nv = String(val || "").trim();
          const nvn = normalizeVal(val);
          if (nk.includes("total de imoveis visitados") && Number(nv) > 0) return true;
          if (nk === "status de atividade atual" && nv === "Realizada") return true;
          return false;
        });

        if (hasVisit) {
          if (isLocacaoLead) acc.visitsLocacao++; else acc.visitsVenda++;
        }
        return acc;
      }, { leadsVenda: 0, leadsLocacao: 0, visitsVenda: 0, visitsLocacao: 0 });

      const brokerSalesFiltered = allSalesInPeriod.filter(s => isMatchStrict(s.vendedor, brokerName));
      const numSales = brokerSalesFiltered.length;

      const brokerRentalsFiltered = sales.filter(s => 
          isMatchStrict(s.vendedor, brokerName) && 
          (normalize(s.tipo || '').includes('loca') || normalize(s.tipo || '').includes('aluguel')) &&
          filterByPeriod(s, "saleDate")
      );
      const numRentals = brokerRentalsFiltered.length;
      
      const salesFrequency = numSales > 0 ? Math.floor(totalDaysCount / numSales) : 0;
      
      const conversionLeadToVisitVenda = leadsVenda > 0 ? (visitsVenda / leadsVenda) * 100 : 0;
      const conversionVisitToSale = visitsVenda > 0 ? (numSales / visitsVenda) * 100 : 0;
      const conversionLeadToSale = leadsVenda > 0 ? (numSales / leadsVenda) * 100 : 0;
      const avgLeadsPerVisitVenda = visitsVenda > 0 ? leadsVenda / visitsVenda : 0;
      const avgVisitsPerSale = numSales > 0 ? visitsVenda / numSales : 0;
      const avgLeadsPerSale = numSales > 0 ? leadsVenda / numSales : 0;

      const conversionLeadToVisitLocacao = leadsLocacao > 0 ? (visitsLocacao / leadsLocacao) * 100 : 0;
      const conversionVisitToRental = visitsLocacao > 0 ? (numRentals / visitsLocacao) * 100 : 0;
      const conversionLeadToRental = leadsLocacao > 0 ? (numRentals / leadsLocacao) * 100 : 0;
      const avgLeadsPerVisitLocacao = visitsLocacao > 0 ? leadsLocacao / visitsLocacao : 0;
      const avgVisitsPerRental = numRentals > 0 ? visitsLocacao / numRentals : 0;
      const avgLeadsPerRental = numRentals > 0 ? leadsLocacao / leadsLocacao : 0;

      const salesAsCapturerInPeriod = allSalesInPeriod.filter(s => isMatchStrict(s.angariador, brokerName));

      const comissaoVenda = brokerSalesFiltered.reduce((acc, s) => acc + (s.comissaoCorretor || 0), 0);
      const comissaoAngariacao = salesAsCapturerInPeriod.reduce((acc, s) => acc + (s.comissaoAngariacao || 0), 0);
      
      const vgvVendidoPeloCorretor = brokerSalesFiltered.reduce((acc, s) => acc + (s.closedValue || 0), 0);
      const vgvAngariadoVendido = salesAsCapturerInPeriod.reduce((acc, s) => acc + (s.closedValue || 0), 0);
      const vgvMetrics = vgvVendidoPeloCorretor + vgvAngariadoVendido;

      const vgvVendidoPercent = totalVgvInPeriod > 0 ? (vgvVendidoPeloCorretor / totalVgvInPeriod) * 100 : 0;
      const vgvAngariadoPercent = totalVgvInPeriod > 0 ? (vgvAngariadoVendido / totalVgvInPeriod) * 100 : 0;
      const vgvTotalPercent = totalVgvInPeriod > 0 ? (vgvMetrics / totalVgvInPeriod) * 100 : 0;

      return {
        name: brokerName,
        capturesSale,
        capturesRent,
        leadsVenda,
        leadsLocacao,
        visitsVenda,
        visitsLocacao,
        numSales,
        numRentals,
        vgvVendido: vgvAngariadoNoEstoque, 
        vglFechado: vglAngariadoNoEstoque,
        salesFrequency,
        conversionLeadToVisitVenda,
        conversionVisitToSale,
        conversionLeadToSale,
        conversionLeadToVisitLocacao,
        conversionVisitToRental,
        conversionLeadToRental,
        avgLeadsPerVisitVenda,
        avgVisitsPerSale,
        avgLeadsPerSale,
        avgLeadsPerVisitLocacao,
        avgVisitsPerRental,
        avgLeadsPerRental,
        comissaoVenda,
        comissaoAngariacao,
        vgvMetrics, 
        vgvVendidoPeloCorretor, 
        vgvAngariadoVendido,
        vgvVendidoPercent,
        vgvAngariadoPercent,
        vgvTotalPercent
      };
    });

    const sortedStats = brokerStats.sort((a, b) => {
      if (performanceView === 'metricas') {
        return (b.comissaoVenda + b.comissaoAngariacao) - (a.comissaoVenda + a.comissaoAngariacao);
      }
      return b.numSales - a.numSales || b.numRentals - a.numRentals;
    });

    // CORREÇÃO DOS TOTAIS: Devem refletir vendas ÚNICAS e não a soma das participações
    const recognizedCapturedSales = allSalesInPeriod.filter(sale => 
      brokers.some(broker => isMatchStrict(sale.angariador, broker))
    );
    const recognizedBrokerSales = allSalesInPeriod.filter(sale => 
      brokers.some(broker => isMatchStrict(sale.vendedor, broker))
    );

    const calculatedTotals = {
        leadsVenda: sortedStats.reduce((acc, s) => acc + s.leadsVenda, 0),
        leadsLocacao: sortedStats.reduce((acc, s) => acc + s.leadsLocacao, 0),
        capturesSale: sortedStats.reduce((acc, s) => acc + s.capturesSale, 0),
        capturesRent: sortedStats.reduce((acc, s) => acc + s.capturesRent, 0),
        visitsVenda: sortedStats.reduce((acc, s) => acc + s.visitsVenda, 0),
        visitsLocacao: sortedStats.reduce((acc, s) => acc + s.visitsLocacao, 0),
        numSales: recognizedBrokerSales.length, // Total real de vendas únicas
        numRentals: sortedStats.reduce((acc, s) => acc + s.numRentals, 0),
        vgvVendido: sortedStats.reduce((acc, s) => acc + s.vgvVendido, 0),
        vglFechado: sortedStats.reduce((acc, s) => acc + s.vglFechado, 0),
        comissaoVenda: sortedStats.reduce((acc, s) => acc + s.comissaoVenda, 0),
        comissaoAngariacao: sortedStats.reduce((acc, s) => acc + s.comissaoAngariacao, 0),
        vgvVendidoPeloCorretor: recognizedBrokerSales.reduce((acc, s) => acc + (s.closedValue || 0), 0),
        vgvAngariadoVendido: recognizedCapturedSales.reduce((acc, s) => acc + (s.closedValue || 0), 0),
        vgvMetrics: totalVgvInPeriod,
    };

    calculatedTotals.avgLeadsPerVisitVenda = calculatedTotals.visitsVenda > 0 ? calculatedTotals.leadsVenda / calculatedTotals.visitsVenda : 0;
    calculatedTotals.conversionLeadToVisitVenda = calculatedTotals.leadsVenda > 0 ? (calculatedTotals.visitsVenda / calculatedTotals.leadsVenda) * 100 : 0;
    calculatedTotals.avgVisitsPerSale = calculatedTotals.numSales > 0 ? calculatedTotals.visitsVenda / calculatedTotals.numSales : 0;
    calculatedTotals.conversionVisitToSale = calculatedTotals.visitsVenda > 0 ? (calculatedTotals.numSales / calculatedTotals.visitsVenda) * 100 : 0;
    calculatedTotals.avgLeadsPerSale = calculatedTotals.numSales > 0 ? calculatedTotals.leadsVenda / calculatedTotals.numSales : 0;
    calculatedTotals.conversionLeadToSale = calculatedTotals.leadsVenda > 0 ? (calculatedTotals.numSales / calculatedTotals.leadsVenda) * 100 : 0;

    calculatedTotals.vgvVendidoPercent = totalVgvInPeriod > 0 ? (calculatedTotals.vgvVendidoPeloCorretor / totalVgvInPeriod) * 100 : 0;
    calculatedTotals.vgvAngariadoPercent = totalVgvInPeriod > 0 ? (calculatedTotals.vgvAngariadoVendido / totalVgvInPeriod) * 100 : 0;
    calculatedTotals.vgvTotalPercent = totalVgvInPeriod > 0 ? (calculatedTotals.vgvMetrics / totalVgvInPeriod) * 100 : 0;

    return { stats: sortedStats, totals: calculatedTotals };
  }, [sales, leads, properties, brokers, selectedMonths, selectedYears, performanceView, normalize]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <Tabs defaultValue="venda" className="w-full" onValueChange={(value) => setPerformanceView(value as 'venda' | 'locacao' | 'metricas')}>
        <CardHeader className="bg-muted/10 border-b py-3 px-4">
          <div className="flex justify-between items-center">
              <CardTitle className="text-base font-bold text-primary">Performance por Corretor</CardTitle>
              <TabsList className="grid w-[300px] grid-cols-3 h-9 p-1">
                  <TabsTrigger value="venda" className="text-xs h-full">Venda</TabsTrigger>
                  <TabsTrigger value="locacao" className="text-xs h-full">Locação</TabsTrigger>
                  <TabsTrigger value="metricas" className="text-xs h-full">Métricas</TabsTrigger>
              </TabsList>
          </div>
        </CardHeader>
        <CardContent className="p-0">
            <TabsContent value="venda" className="m-0">
                <Table className="border-collapse">
                    <TableHeader>
                    <TableRow className="bg-muted/5">
                        <TableHead className="font-bold border-r text-xs uppercase sticky left-0 bg-muted/5 z-10">Corretor</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Leads</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Angariados</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Visitas</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase bg-primary/5">Vendas</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Média Leads p/ Visita</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Média Visitas p/ Venda</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase bg-green-50/20">Média Leads p/ Venda</TableHead>
                        <TableHead className="text-right border-r text-xs uppercase">Frequência</TableHead>
                        <TableHead className="text-right font-bold text-xs uppercase bg-primary/5">VGV Est. (Ang.)</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {stats.map((row) => (
                        <TableRow key={row.name} className="hover:bg-muted/5 group">
                        <TableCell className="font-semibold border-r text-sm py-2 sticky left-0 bg-white group-hover:bg-muted/5 z-10">{row.name}</TableCell>
                        <TableCell className="text-center border-r py-2">
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 shadow-none border-none text-xs">{row.leadsVenda}</Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-1">
                            <Badge variant="outline" className={`border-emerald-200 bg-emerald-50/50 text-emerald-700 text-xs font-bold ${row.capturesSale === 0 && 'opacity-20'}`}>{row.capturesSale}</Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-2">
                            <Badge variant="outline" className={`border-indigo-200 text-indigo-700 text-xs ${row.visitsVenda === 0 && 'opacity-20'}`}>{row.visitsVenda}</Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 text-sm font-bold bg-primary/5 text-primary">{row.numSales}</TableCell>
                        <TableCell className="text-center border-r py-2 bg-orange-50/10 text-xs font-bold text-orange-700">
                            <div className="flex flex-col items-center leading-tight">
                                <span>{row.avgLeadsPerVisitVenda.toFixed(1)}</span>
                                <span className="text-[9px] opacity-60">{row.conversionLeadToVisitVenda.toFixed(1)}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-rose-50/10 text-xs font-bold text-rose-700">
                            <div className="flex flex-col items-center leading-tight">
                                <span>{row.avgVisitsPerSale.toFixed(1)}</span>
                                <span className="text-[9px] opacity-60">{row.conversionVisitToSale.toFixed(1)}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-green-50/20 text-xs font-bold text-green-700">
                            <div className="flex flex-col items-center leading-tight">
                                <span>{row.avgLeadsPerSale.toFixed(1)}</span>
                                <span className="text-[9px] opacity-60">{row.conversionLeadToSale.toFixed(1)}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right border-r py-2 text-xs font-bold text-amber-700">{row.salesFrequency > 0 ? `${row.salesFrequency} dias` : "-"}</TableCell>
                        <TableCell className="text-right py-2 font-bold text-primary bg-primary/5 text-sm">{formatCurrency(row.vgvVendido)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                    <TableFooter className="bg-primary/5 font-bold">
                        <TableRow>
                            <TableCell className="sticky left-0 bg-primary/5 z-10 border-r">TOTAL</TableCell>
                            <TableCell className="text-center border-r">{totals?.leadsVenda}</TableCell>
                            <TableCell className="text-center border-r">{totals?.capturesSale}</TableCell>
                            <TableCell className="text-center border-r">{totals?.visitsVenda}</TableCell>
                            <TableCell className="text-center border-r text-primary">{totals?.numSales}</TableCell>
                            <TableCell className="text-center border-r">
                                <div className="flex flex-col items-center leading-tight">
                                    <span>{totals?.avgLeadsPerVisitVenda.toFixed(1)}</span>
                                    <span className="text-[9px] opacity-60">{totals?.conversionLeadToVisitVenda.toFixed(1)}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center border-r">
                                <div className="flex flex-col items-center leading-tight">
                                    <span>{totals?.avgVisitsPerSale.toFixed(1)}</span>
                                    <span className="text-[9px] opacity-60">{totals?.conversionVisitToSale.toFixed(1)}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center border-r">
                                <div className="flex flex-col items-center leading-tight">
                                    <span>{totals?.avgLeadsPerSale.toFixed(1)}</span>
                                    <span className="text-[9px] opacity-60">{totals?.conversionLeadToSale.toFixed(1)}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right border-r">-</TableCell>
                            <TableCell className="text-right text-primary">{totals ? formatCurrency(totals.vgvVendido) : 'R$ 0'}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </TabsContent>
            <TabsContent value="locacao" className="m-0">
                <Table className="border-collapse">
                    <TableHeader>
                    <TableRow className="bg-muted/5">
                        <TableHead className="font-bold border-r text-xs uppercase sticky left-0 bg-muted/5 z-10">Corretor</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Leads</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Angariados</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Visitas</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase bg-primary/5">Locações</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Média Leads p/ Visita</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Média Visitas p/ Loc.</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase bg-green-50/20">Média Leads p/ Loc.</TableHead>
                        <TableHead className="text-right font-bold text-xs uppercase bg-primary/5">VGL Est. (Ang.)</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {stats.map((row) => (
                        <TableRow key={row.name} className="hover:bg-muted/5 group">
                        <TableCell className="font-semibold border-r text-sm py-2 sticky left-0 bg-white group-hover:bg-muted/5 z-10">{row.name}</TableCell>
                        <TableCell className="text-center border-r py-2">
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 shadow-none border-none text-xs">{row.leadsLocacao}</Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-1">
                            <Badge variant="outline" className={`border-emerald-200 bg-emerald-50/50 text-emerald-700 text-xs font-bold ${row.capturesRent === 0 && 'opacity-20'}`}>{row.capturesRent}</Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-2">
                            <Badge variant="outline" className={`border-indigo-200 text-indigo-700 text-xs ${row.visitsLocacao === 0 && 'opacity-20'}`}>{row.visitsLocacao}</Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 text-sm font-bold bg-primary/5 text-primary">{row.numRentals}</TableCell>
                        <TableCell className="text-center border-r py-2 bg-orange-50/10 text-xs font-bold text-orange-700">
                            <div className="flex flex-col items-center leading-tight">
                                <span>{row.avgLeadsPerVisitLocacao.toFixed(1)}</span>
                                <span className="text-[9px] opacity-60">{row.conversionLeadToVisitLocacao.toFixed(1)}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-rose-50/10 text-xs font-bold text-rose-700">
                            <div className="flex flex-col items-center leading-tight">
                                <span>{row.avgVisitsPerRental.toFixed(1)}</span>
                                <span className="text-[9px] opacity-60">{row.conversionVisitToRental.toFixed(1)}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-green-50/20 text-xs font-bold text-green-700">
                            <div className="flex flex-col items-center leading-tight">
                                <span>{row.avgLeadsPerRental.toFixed(1)}</span>
                                <span className="text-[9px] opacity-60">{row.conversionLeadToRental.toFixed(1)}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right py-2 font-bold text-primary bg-primary/5 text-sm">{formatCurrency(row.vglFechado)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                    <TableFooter className="bg-primary/5 font-bold">
                        <TableRow>
                            <TableCell className="sticky left-0 bg-primary/5 z-10 border-r">TOTAL</TableCell>
                            <TableCell className="text-center border-r">{totals?.leadsLocacao}</TableCell>
                            <TableCell className="text-center border-r">{totals?.capturesRent}</TableCell>
                            <TableCell className="text-center border-r">{totals?.visitsLocacao}</TableCell>
                            <TableCell className="text-center border-r text-primary">{totals?.numRentals}</TableCell>
                            <TableCell className="text-center border-r">
                                <div className="flex flex-col items-center leading-tight">
                                    <span>{totals?.avgLeadsPerVisitLocacao.toFixed(1)}</span>
                                    <span className="text-[9px] opacity-60">{totals?.conversionLeadToVisitLocacao.toFixed(1)}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center border-r">
                                <div className="flex flex-col items-center leading-tight">
                                    <span>{totals?.avgVisitsPerRental.toFixed(1)}</span>
                                    <span className="text-[9px] opacity-60">{totals?.conversionVisitToRental.toFixed(1)}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center border-r">
                                <div className="flex flex-col items-center leading-tight">
                                    <span>{totals?.avgLeadsPerRental.toFixed(1)}</span>
                                    <span className="text-[9px] opacity-60">{totals?.conversionLeadToRental.toFixed(1)}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right text-primary">{totals ? formatCurrency(totals.vglFechado) : 'R$ 0'}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </TabsContent>
            <TabsContent value="metricas" className="m-0">
              <TooltipProvider>
              {(() => {
                const filteredStats = stats.filter(b => b.comissaoVenda > 0 || b.comissaoAngariacao > 0 || b.vgvMetrics > 0);
                if (filteredStats.length > 0) {
                  return (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="font-semibold border-r">Corretor</TableHead>
                                <TableHead colSpan={2} className="text-center font-semibold border-r">
                                    <div className="flex items-center justify-center gap-1">
                                      Venda (Comissão)
                                      <Tooltip>
                                        <TooltipTrigger><Info className="h-3 w-3 opacity-50" /></TooltipTrigger>
                                        <TooltipContent>Comissão recebida por atuar como Vendedor.</TooltipContent>
                                      </Tooltip>
                                    </div>
                                </TableHead>
                                <TableHead colSpan={2} className="text-center font-semibold border-r">
                                    <div className="flex items-center justify-center gap-1">
                                      Angariação (Comissão)
                                      <Tooltip>
                                        <TooltipTrigger><Info className="h-3 w-3 opacity-50" /></TooltipTrigger>
                                        <TooltipContent>Comissão recebida por ter captado o imóvel que foi vendido.</TooltipContent>
                                      </Tooltip>
                                    </div>
                                </TableHead>
                                <TableHead colSpan={2} className="text-center font-bold border-r">
                                    <div className="flex items-center justify-center gap-1">
                                      VGV Angariado (Fechado)
                                      <Tooltip>
                                        <TooltipTrigger><Info className="h-3 w-3 opacity-50" /></TooltipTrigger>
                                        <TooltipContent>Valor total dos imóveis que VOCÊ CAPTOU e foram vendidos.</TooltipContent>
                                      </Tooltip>
                                    </div>
                                </TableHead>
                                <TableHead colSpan={2} className="text-center font-bold border-r">
                                    <div className="flex items-center justify-center gap-1">
                                      VGV Vendido
                                      <Tooltip>
                                        <TooltipTrigger><Info className="h-3 w-3 opacity-50" /></TooltipTrigger>
                                        <TooltipContent>Valor total dos imóveis que VOCÊ VENDEU (atendimento ao comprador).</TooltipContent>
                                      </Tooltip>
                                    </div>
                                </TableHead>
                                <TableHead colSpan={2} className="text-center font-bold border-r">
                                    <div className="flex items-center justify-center gap-1">
                                      VGV Total (Participação)
                                      <Tooltip>
                                        <TooltipTrigger><Info className="h-3 w-3 opacity-50" /></TooltipTrigger>
                                        <TooltipContent>Soma da sua produção (Angariação Vendida + Venda Direta).</TooltipContent>
                                      </Tooltip>
                                    </div>
                                </TableHead>
                                <TableHead className="text-right font-bold text-primary">Comissão Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredStats.map((broker) => (
                            <TableRow key={broker.name}>
                                <TableCell className="font-semibold border-r">{broker.name}</TableCell>
                                <TableCell className="text-right border-l">{broker.comissaoVenda > 0 ? formatCurrency(broker.comissaoVenda) : ''}</TableCell>
                                <TableCell className="text-right text-[10px] text-muted-foreground border-r">-</TableCell>
                                <TableCell className="text-right">{broker.comissaoAngariacao > 0 ? formatCurrency(broker.comissaoAngariacao) : ''}</TableCell>
                                <TableCell className="text-right text-[10px] text-muted-foreground border-r">-</TableCell>
                                <TableCell className="text-right">{broker.vgvAngariadoVendido > 0 ? formatCurrency(broker.vgvAngariadoVendido) : ''}</TableCell>
                                <TableCell className="text-right text-[10px] text-muted-foreground border-r">{broker.vgvAngariadoVendido > 0 ? `${broker.vgvAngariadoPercent.toFixed(1)}%` : ''}</TableCell>
                                <TableCell className="text-right">{broker.vgvVendidoPeloCorretor > 0 ? formatCurrency(broker.vgvVendidoPeloCorretor) : ''}</TableCell>
                                <TableCell className="text-right text-[10px] text-muted-foreground border-r">{broker.vgvVendidoPeloCorretor > 0 ? `${broker.vgvVendidoPercent.toFixed(1)}%` : ''}</TableCell>
                                <TableCell className="text-right font-bold">{broker.vgvMetrics > 0 ? formatCurrency(broker.vgvMetrics) : ''}</TableCell>
                                <TableCell className="text-right text-[10px] font-medium text-primary/70 border-r">{broker.vgvMetrics > 0 ? `${broker.vgvTotalPercent.toFixed(1)}%` : ''}</TableCell>
                                <TableCell className="text-right font-bold text-primary">{(broker.comissaoVenda + broker.comissaoAngariacao) > 0 ? formatCurrency(broker.comissaoVenda + broker.comissaoAngariacao) : ''}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                        <TableFooter className="bg-primary/5 font-bold">
                            <TableRow>
                                <TableCell className="border-r">TOTAL</TableCell>
                                <TableCell className="text-right border-l" colSpan={2}>{totals ? formatCurrency(totals.comissaoVenda) : 'R$ 0'}</TableCell>
                                <TableCell className="text-right" colSpan={2}>{totals ? formatCurrency(totals.comissaoAngariacao) : 'R$ 0'}</TableCell>
                                <TableCell className="text-right">{totals ? formatCurrency(totals.vgvAngariadoVendido) : 'R$ 0'}</TableCell>
                                <TableCell className="text-right text-[10px] border-r">{totals?.vgvAngariadoPercent.toFixed(1)}%</TableCell>
                                <TableCell className="text-right">{totals ? formatCurrency(totals.vgvVendidoPeloCorretor) : 'R$ 0'}</TableCell>
                                <TableCell className="text-right text-[10px] border-r">{totals?.vgvVendidoPercent.toFixed(1)}%</TableCell>
                                <TableCell className="text-right">{totals ? formatCurrency(totals.vgvMetrics) : 'R$ 0'}</TableCell>
                                <TableCell className="text-right text-[10px] border-r">{totals?.vgvTotalPercent.toFixed(1)}%</TableCell>
                                <TableCell className="text-right text-primary">{totals ? formatCurrency(totals.comissaoVenda + totals.comissaoAngariacao) : 'R$ 0'}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                  );
                } else {
                  return <div className="py-20 text-center text-muted-foreground text-sm">Nenhum corretor com métricas financeiras no período.</div>;
                }
              })()}
              </TooltipProvider>
            </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
