"use client";

import { useMemo, useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const stats = useMemo(() => {
    if (!brokers || brokers.length === 0) return [];

    const totalDaysCount = 427; // Maintained for sales frequency as requested

    const filterByPeriod = (item: any, dateField: string) => {
        const d = parseDate(item[dateField]);
        if (!d) return false;
        const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(String(d.getUTCMonth()));
        const yearMatch = selectedYears.length === 0 || selectedYears.includes(String(d.getUTCFullYear()));
        return monthMatch && yearMatch;
    };

    const allSalesInPeriod = sales.filter(s => {
        const isSaleType = !normalize(s.tipo || '').includes('loca') && !normalize(s.tipo || '').includes('aluguel');
        if (!isSaleType) return false;
        return filterByPeriod(s, 'saleDate');
    });
    const totalVgvInPeriod = allSalesInPeriod.reduce((acc, s) => acc + (s.closedValue || 0), 0);

    const allPropertiesInPeriod = properties.filter(p => filterByPeriod(p, 'captureDate'));
    const totalVgvAngariadoInPeriod = allPropertiesInPeriod.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0);


    return brokers.map(brokerName => {
      const configBrokerName = normalize(brokerName);
      
      const isMatch = (sheetName: string | undefined | null) => {
        if (!sheetName || sheetName === "N/A") return false;
        const normalizedSheetName = normalize(String(sheetName || ""));
        if (!normalizedSheetName) return false;
        
        return normalizedSheetName.includes(configBrokerName) || configBrokerName.includes(normalizedSheetName);
      };

      const isExactMatch = (sheetName: string | undefined | null) => {
        if (!sheetName) return false;
        return normalize(sheetName) === configBrokerName;
      }

      // 1. Angariações
      const bPropsFiltered = properties.filter(p => {
        const brokerField = p.brokerId || p.angariador || p.captador;
        if (!isMatch(brokerField)) return false;
        return filterByPeriod(p, 'captureDate');
      });
      
      const capturesSale = bPropsFiltered.filter(p => p.saleValue && Number(p.saleValue) > 0).length;
      const capturesRent = bPropsFiltered.filter(p => p.rentalValue && Number(p.rentalValue) > 0).length;
      const vgvAngariado = bPropsFiltered.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0);
      const vglAngariado = bPropsFiltered.reduce((acc, p) => acc + (Number(p.rentalValue) || 0), 0);

      // 2. Leads & Visitas
      const brokerLeadsAll = leads.filter(l => {
        if (!l) return false;
        const entries = Object.entries(l);
        return entries.some(([key, val]) => {
          const nk = normalize(key);
          const isBrokerColumn = nk.includes("corretor") || nk.includes("responsavel") || nk.includes("atendente") || nk.includes("vendedor") || nk.includes("broker");
          return isBrokerColumn && isMatch(String(val || ""));
        });
      });

      const brokerLeadsFiltered = brokerLeadsAll.filter(l => {
        const keys = Object.keys(l);
        const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo"));
        return dateKey ? filterByPeriod(l, dateKey) : true;
      });

      const { leadsVenda, leadsLocacao, visitsVenda, visitsLocacao } = brokerLeadsFiltered.reduce((acc, l) => {
        const entries = Object.entries(l);
        const isLocacaoLead = entries.some(([key, val]) => {
            const nk = normalize(key);
            const nv = normalize(String(val || ""));
            return (nk.includes("natureza") || nk.includes("negociacao") || nk === "tipo") && 
                   (nv.includes("loca") || nv.includes("alug"));
        });
        
        if (isLocacaoLead) acc.leadsLocacao++; else acc.leadsVenda++;

        const hasVisit = entries.some(([key, val]) => {
          const nk = normalize(key);
          const nv = normalize(String(val || ""));
          return nk.includes("status da atividade atual") && nv.includes("realizada");
        });

        if (hasVisit) {
          if (isLocacaoLead) acc.visitsLocacao++; else acc.visitsVenda++;
        }
        return acc;
      }, { leadsVenda: 0, leadsLocacao: 0, visitsVenda: 0, visitsLocacao: 0 });

      // 3. Vendas & Locações (Deals)
      const brokerSalesAll = sales.filter(s => 
          isMatch(s.vendedor) && 
          !normalize(s.tipo || '').includes('loca') && 
          !normalize(s.tipo || '').includes('aluguel')
      );
      const brokerSalesFiltered = brokerSalesAll.filter(s => filterByPeriod(s, "saleDate"));
      const numSales = brokerSalesFiltered.length;

      const brokerRentalsAll = sales.filter(s => 
          isExactMatch(s.vendedor) && 
          (normalize(s.tipo || '').includes('loca') || normalize(s.tipo || '').includes('aluguel'))
      );
      const brokerRentalsFiltered = brokerRentalsAll.filter(s => filterByPeriod(s, "saleDate"));
      const numRentals = brokerRentalsFiltered.length;
      
      const salesFrequency = brokerSalesAll.length > 0 ? Math.floor(totalDaysCount / brokerSalesAll.length) : 0;
      
      let rentalsFrequency = 0;
      if (numRentals > 1) {
        const rentalDates = brokerRentalsFiltered
          .map(r => parseDate(r.saleDate))
          .filter((d): d is Date => d !== null)
          .sort((a, b) => a.getTime() - b.getTime());
        
        if (rentalDates.length > 1) {
          const firstDate = rentalDates[0];
          const lastDate = rentalDates[rentalDates.length - 1];
          const diffTime = lastDate.getTime() - firstDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          rentalsFrequency = Math.floor(diffDays / (numRentals - 1));
        }
      }
      
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
      const avgLeadsPerRental = numRentals > 0 ? leadsLocacao / numRentals : 0;

      // Metrics for the new "Métricas" tab
      const salesAsSellerInPeriod = allSalesInPeriod.filter(s => isMatch(s.vendedor));
      const salesAsCapturerInPeriod = allSalesInPeriod.filter(s => isMatch(s.angariador));

      const comissaoVenda = salesAsSellerInPeriod.reduce((acc, s) => acc + (s.comissaoCorretor || 0), 0);
      
      const comissaoAngariacao = salesAsCapturerInPeriod.reduce((acc, s) => {
        const comissaoImobiliaria = s.comissaoImobiliaria || 0;
        return acc + (comissaoImobiliaria * 0.3);
      }, 0);
      
      const vgvVendidoPeloCorretor = salesAsSellerInPeriod.reduce((acc, s) => acc + (s.closedValue || 0), 0);
      
      const vgvDasVendasAngariadas = salesAsCapturerInPeriod.reduce((acc, s) => acc + (s.closedValue || 0), 0);
      const vgvMetrics = vgvVendidoPeloCorretor + vgvDasVendasAngariadas;

      const comissaoVendaPercent = totalVgvInPeriod > 0 ? (vgvVendidoPeloCorretor / totalVgvInPeriod) * 100 : 0;
      const comissaoAngariacaoPercent = totalVgvAngariadoInPeriod > 0 ? (vgvAngariado / totalVgvAngariadoInPeriod) * 100 : 0;

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
        vgvVendido: vgvAngariado, // This is VGV Angariado, kept for the original table
        vglFechado: vglAngariado,
        salesFrequency,
        rentalsFrequency,
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
        comissaoVendaPercent,
        comissaoAngariacaoPercent,
        vgvMetrics,
      };
    }).sort((a, b) => {
      if (performanceView === 'metricas') {
        return (b.comissaoVenda + b.comissaoAngariacao) - (a.comissaoVenda + a.comissaoAngariacao);
      }
      if (performanceView === 'venda') {
        return b.numSales - a.numSales || b.vgvVendido - a.vgvVendido;
      }
      return b.numRentals - a.numRentals || b.vglFechado - a.vglFechado;
    });
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
                {stats.length > 0 ? (
                <Table className="border-collapse">
                    <TableHeader>
                    <TableRow className="bg-muted/5">
                        <TableHead className="font-bold border-r text-xs uppercase sticky left-0 bg-muted/5 z-10">Corretor</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Leads</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Angariados</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Visitas</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase bg-primary/5">Vendas</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">
                        Média Leads p/ Visita
                        </TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">
                        Média Visitas p/ Venda
                        </TableHead>
                        <TableHead className="text-center border-r text-xs uppercase bg-green-50/20">
                        Média Leads p/ Venda
                        </TableHead>
                        <TableHead className="text-right border-r text-xs uppercase">Frequência</TableHead>
                        <TableHead className="text-right font-bold text-xs uppercase bg-primary/5">VGV Angariado</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {stats.map((row) => (
                        <TableRow key={row.name} className="hover:bg-muted/5 group">
                        <TableCell className="font-semibold border-r text-sm py-2 sticky left-0 bg-white group-hover:bg-muted/5 z-10">{row.name}</TableCell>
                        <TableCell className="text-center border-r py-2">
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 shadow-none border-none text-xs">
                            {row.leadsVenda}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-1">
                            <Badge variant="outline" className={`border-emerald-200 bg-emerald-50/50 text-emerald-700 text-xs font-bold ${row.capturesSale === 0 && 'opacity-20'}`}>
                                {row.capturesSale}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-2">
                            <Badge variant="outline" className={`border-indigo-200 text-indigo-700 text-xs ${row.visitsVenda === 0 && 'opacity-20'}`}>
                            {row.visitsVenda}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 text-sm font-bold bg-primary/5 text-primary">
                            {row.numSales}
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-orange-50/10 text-xs font-bold text-orange-700 relative">
                            <div className="flex flex-col items-center justify-center h-full leading-tight">
                                <span className="font-bold text-orange-700">
                                {row.avgLeadsPerVisitVenda.toFixed(1)}
                                </span>
                                <span className="text-[9px] text-orange-700/60 font-medium">
                                {row.conversionLeadToVisitVenda.toFixed(1)}%
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-rose-50/10 text-xs font-bold text-rose-700 relative">
                            <div className="flex flex-col items-center justify-center h-full leading-tight">
                                <span className="font-bold text-rose-700">
                                {row.avgVisitsPerSale.toFixed(1)}
                                </span>
                                <span className="text-[9px] text-rose-700/60 font-medium">
                                {row.conversionVisitToSale.toFixed(1)}%
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-green-50/20 text-xs font-bold text-green-700 relative">
                            <div className="flex flex-col items-center justify-center h-full leading-tight">
                                <span className="font-bold text-green-700">
                                {row.avgLeadsPerSale.toFixed(1)}
                                </span>
                                <span className="text-[9px] text-green-700/60 font-medium">
                                {row.conversionLeadToSale.toFixed(1)}%
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right border-r py-2 text-xs font-bold text-amber-700">
                            {row.salesFrequency > 0 ? `${row.salesFrequency} dias` : "-"}
                        </TableCell>
                        <TableCell className="text-right py-2 font-bold text-primary bg-primary/5 text-sm">
                            {formatCurrency(row.vgvVendido)}
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                ) : (
                <div className="py-20 text-center text-muted-foreground">
                    <p className="text-sm font-medium">Nenhum corretor encontrado nos dados das planilhas.</p>
                    <p className="text-xs text-muted-foreground/80">Verifique se os nomes dos corretores estão preenchidos nas planilhas.</p>
                </div>
                )}
            </TabsContent>
            <TabsContent value="locacao" className="m-0">
                {stats.length > 0 ? (
                <Table className="border-collapse">
                    <TableHeader>
                    <TableRow className="bg-muted/5">
                        <TableHead className="font-bold border-r text-xs uppercase sticky left-0 bg-muted/5 z-10">Corretor</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Leads</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Angariados</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">Visitas</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase bg-primary/5">Locações</TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">
                        Média Leads p/ Visita
                        </TableHead>
                        <TableHead className="text-center border-r text-xs uppercase">
                        Média Visitas p/ Loc.
                        </TableHead>
                        <TableHead className="text-center border-r text-xs uppercase bg-green-50/20">
                        Média Leads p/ Loc.
                        </TableHead>
                        <TableHead className="text-right border-r text-xs uppercase">Frequência</TableHead>
                        <TableHead className="text-right font-bold text-xs uppercase bg-primary/5">VGL Angariado</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {stats.map((row) => (
                        <TableRow key={row.name} className="hover:bg-muted/5 group">
                        <TableCell className="font-semibold border-r text-sm py-2 sticky left-0 bg-white group-hover:bg-muted/5 z-10">{row.name}</TableCell>
                        <TableCell className="text-center border-r py-2">
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 shadow-none border-none text-xs">
                            {row.leadsLocacao}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-1">
                            <Badge variant="outline" className={`border-emerald-200 bg-emerald-50/50 text-emerald-700 text-xs font-bold ${row.capturesRent === 0 && 'opacity-20'}`}>
                                {row.capturesRent}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-2">
                            <Badge variant="outline" className={`border-indigo-200 text-indigo-700 text-xs ${row.visitsLocacao === 0 && 'opacity-20'}`}>
                            {row.visitsLocacao}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 text-sm font-bold bg-primary/5 text-primary">
                            {row.numRentals}
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-orange-50/10 text-xs font-bold text-orange-700 relative">
                            <div className="flex flex-col items-center justify-center h-full leading-tight">
                                <span className="font-bold text-orange-700">
                                {row.avgLeadsPerVisitLocacao.toFixed(1)}
                                </span>
                                <span className="text-[9px] text-orange-700/60 font-medium">
                                {row.conversionLeadToVisitLocacao.toFixed(1)}%
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-rose-50/10 text-xs font-bold text-rose-700 relative">
                            <div className="flex flex-col items-center justify-center h-full leading-tight">
                                <span className="font-bold text-rose-700">
                                {row.avgVisitsPerRental.toFixed(1)}
                                </span>
                                <span className="text-[9px] text-rose-700/60 font-medium">
                                {row.conversionVisitToRental.toFixed(1)}%
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center border-r py-2 bg-green-50/20 text-xs font-bold text-green-700 relative">
                            <div className="flex flex-col items-center justify-center h-full leading-tight">
                                <span className="font-bold text-green-700">
                                {row.avgLeadsPerRental.toFixed(1)}
                                </span>
                                <span className="text-[9px] text-green-700/60 font-medium">
                                {row.conversionLeadToRental.toFixed(1)}%
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right border-r py-2 text-xs font-bold text-amber-700">
                            {row.rentalsFrequency > 0 ? `${row.rentalsFrequency} dias` : "-"}
                        </TableCell>
                        <TableCell className="text-right py-2 font-bold text-primary bg-primary/5 text-sm">
                            {formatCurrency(row.vglFechado)}
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                ) : (
                <div className="py-20 text-center text-muted-foreground">
                    <p className="text-sm font-medium">Nenhum corretor encontrado nos dados das planilhas.</p>
                    <p className="text-xs text-muted-foreground/80">Verifique se os nomes dos corretores estão preenchidos nas planilhas.</p>
                </div>
                )}
            </TabsContent>
            <TabsContent value="metricas" className="m-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-semibold">Corretor</TableHead>
                            <TableHead className="text-center font-semibold border-l">Venda</TableHead>
                            <TableHead className="text-right font-semibold border-l">Comissão Angariação (R$)</TableHead>
                            <TableHead className="text-right font-semibold">Comissão Angariação (%)</TableHead>
                            <TableHead className="text-right font-bold align-bottom border-l">VGV (R$)</TableHead>
                            <TableHead className="text-right font-bold align-bottom border-l">Comissão Acumulada</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {stats.map((broker) => (
                        <TableRow key={broker.name}>
                            <TableCell className="font-semibold">{broker.name}</TableCell>
                            <TableCell className="text-right border-l">
                                {broker.comissaoVenda > 0 ? formatCurrency(broker.comissaoVenda) : ''}
                            </TableCell>
                            <TableCell className="text-right border-l">
                                {broker.comissaoAngariacao > 0 ? formatCurrency(broker.comissaoAngariacao) : ''}
                            </TableCell>
                            <TableCell className="text-right">
                                {broker.comissaoAngariacao > 0 ? `${broker.comissaoAngariacaoPercent.toFixed(1)}%` : ''}
                            </TableCell>
                            <TableCell className="text-right font-bold border-l">
                                {broker.vgvMetrics > 0 ? formatCurrency(broker.vgvMetrics) : ''}
                            </TableCell>
                            <TableCell className="text-right font-bold border-l text-primary">
                                {(broker.comissaoVenda + broker.comissaoAngariacao) > 0 ? formatCurrency(broker.comissaoVenda + broker.comissaoAngariacao) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
