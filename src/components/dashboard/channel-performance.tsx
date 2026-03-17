"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";


interface ChannelPerformanceProps {
  leads: any[];
  sales: any[];
}

type ChannelCost = { type: 'fixed'; value: number } | { type: 'monthly'; value: (number | string)[] };


export function ChannelPerformance({ leads, sales }: ChannelPerformanceProps) {
  const [view, setView] = useState<'anual' | 'media' | 'custos'>('anual');
  const [channelCosts, setChannelCosts] = useState<Record<string, ChannelCost>>({});
  const [isCostDialogOpen, setIsCostDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [tempCost, setTempCost] = useState<ChannelCost | null>(null);

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const isLastDay = now.getDate() === lastDayOfCurrentMonth;

  const normalize = useCallback((s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), []);

  const getMappedChannel = useCallback((rawChannel: any): string | null => {
    if (!rawChannel) return "Direto/Indicação";
    const normalized = normalize(String(rawChannel));
    
    if (['facebook', 'instagram', 'meta'].some(term => normalized.includes(term))) {
        return 'Meta';
    }
    
    return String(rawChannel).trim();
  }, [normalize]);

  useEffect(() => {
    const savedCosts = localStorage.getItem('channel_costs');
    if (savedCosts) {
      try {
        setChannelCosts(JSON.parse(savedCosts));
      } catch (e) {
        console.error("Failed to parse channel costs from localStorage", e);
      }
    }
  }, []);

  const handleOpenCostDialog = (channel: string) => {
    const currentCost = channelCosts[channel] || { type: 'fixed', value: 0 };
    setTempCost(currentCost);
    setEditingChannel(channel);
    setIsCostDialogOpen(true);
  };

  const handleSaveCosts = () => {
    if (editingChannel && tempCost) {
      const newCosts = { ...channelCosts, [editingChannel]: tempCost };
      setChannelCosts(newCosts);
      localStorage.setItem('channel_costs', JSON.stringify(newCosts));
    }
    setIsCostDialogOpen(false);
    setEditingChannel(null);
    setTempCost(null);
  };

  const handleCostTypeChange = (isFixed: boolean) => {
    if (!tempCost) return;
  
    if (isFixed) {
      // When switching to fixed, calculate the average of monthly values as the new fixed monthly cost
      const monthlyValues = Array.isArray(tempCost.value) ? tempCost.value.map(v => Number(v) || 0) : [];
      const total = monthlyValues.reduce((a, b) => a + b, 0);
      const positiveMonths = monthlyValues.filter(v => v > 0).length;
      const average = positiveMonths > 0 ? total / positiveMonths : 0;
      setTempCost({ type: 'fixed', value: average });
    } else {
      // When switching to variable, populate all months with the current fixed monthly value
      const fixedValue = typeof tempCost.value === 'number' ? tempCost.value : 0;
      setTempCost({ type: 'monthly', value: Array(12).fill(fixedValue) });
    }
  };

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

    const leadChannels = leads.map(lead => {
      const keys = Object.keys(lead);
      const sourceKey = keys.find(k => normalize(k) === "fonte" || normalize(k).includes("fonte") || normalize(k) === "origem" || normalize(k).includes("origem") || normalize(k) === "canal");
      const rawChannel = sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação";
      return getMappedChannel(rawChannel);
    });

    const saleChannels = sales.map(sale => getMappedChannel(sale.origem || ''));

    const allChannels = Array.from(
      new Set([...leadChannels, ...saleChannels])
    ).filter((c): c is string => c && c !== "undefined" && c !== "null" && c !== "" && c.toLowerCase() !== 'n/a');

    allChannels.forEach(channel => {
      if (!data[channel]) {
        data[channel] = {
          venda: new Array(12).fill(0),
          locacao: new Array(12).fill(0)
        };
      }
    });

    leads.forEach(lead => {
      const keys = Object.keys(lead);
      
      const sourceKey = keys.find(k => {
        const nk = normalize(k);
        return nk === "fonte" || nk.includes("fonte") || nk === "origem" || nk.includes("origem") || nk === "canal";
      });
      const rawChannel = sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação";

      const channel = getMappedChannel(rawChannel);
      if (!channel || !data[channel]) return;

      const natureKey = keys.find(k => {
        const nk = normalize(k);
        return nk.includes("natureza") || nk.includes("negociacao");
      });
      
      let isLocacao = false;
      if (natureKey && lead[natureKey]) {
        const nVal = normalize(lead[natureKey]);
        if (nVal.includes("loca") || nVal.includes("alug")) isLocacao = true;
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
  }, [leads, sales, currentYear, getMappedChannel, normalize]);

  const averageData = useMemo(() => {
    const monthsElapsed = new Date().getMonth() + 1;

    const leadChannels = leads.map(lead => {
      const keys = Object.keys(lead);
      const sourceKey = keys.find(k => normalize(k) === "fonte" || normalize(k).includes("fonte") || normalize(k) === "origem" || normalize(k).includes("origem") || normalize(k) === "canal");
      const rawChannel = sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação";
      return getMappedChannel(rawChannel);
    });

    const saleChannels = sales.map(sale => getMappedChannel(sale.origem || ''));
    
    const allChannels = Array.from(
        new Set([...leadChannels, ...saleChannels])
    ).filter((c): c is string => c && c !== "undefined" && c !== "null" && c !== "" && c.toLowerCase() !== 'n/a');

    const data = allChannels.map(channel => {
      const channelLeads = leads.filter(lead => {
        const keys = Object.keys(lead);
        const sourceKey = keys.find(k => normalize(k) === "fonte" || normalize(k).includes("fonte") || normalize(k) === "origem" || normalize(k).includes("origem") || normalize(k) === "canal");
        const rawChannel = sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação";
        
        const leadChannel = getMappedChannel(rawChannel);
        
        const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo") || normalize(k).includes("criado"));
        const date = dateKey ? parseDate(lead[dateKey]) : null;
        
        return leadChannel === channel && date && date.getFullYear() === currentYear;
      });

      const { leadsVenda, leadsLocacao, visitsVenda, visitsLocacao } = channelLeads.reduce((acc, l) => {
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
          return (nk.includes("status da atividade atual") || nk.includes("visit")) && (nv.includes("realizada") || nv.includes("sim"));
        });

        if (hasVisit) {
          if (isLocacaoLead) acc.visitsLocacao++; else acc.visitsVenda++;
        }
        return acc;
      }, { leadsVenda: 0, leadsLocacao: 0, visitsVenda: 0, visitsLocacao: 0 });

      const channelSales = sales.filter(s => {
        const rawSaleChannel = s.origem || '';

        const saleChannel = getMappedChannel(rawSaleChannel);
        const date = parseDate(s.saleDate);
        
        return saleChannel === channel && date && date.getFullYear() === currentYear;
      });

      const numSales = channelSales.filter(s => !normalize(s.tipo || '').includes('loca') && !normalize(s.tipo || '').includes('aluguel')).length;
      const numRentals = channelSales.filter(s => normalize(s.tipo || '').includes('loca') || normalize(s.tipo || '').includes('aluguel')).length;

      return {
        channel,
        mediaLeadsVenda: leadsVenda > 0 ? leadsVenda / monthsElapsed : 0,
        mediaVisitasVenda: visitsVenda > 0 ? visitsVenda / monthsElapsed : 0,
        convVisitaVenda: visitsVenda > 0 ? (numSales / visitsVenda) * 100 : 0,
        mediaLeadsLocacao: leadsLocacao > 0 ? leadsLocacao / monthsElapsed : 0,
        mediaVisitasLocacao: visitsLocacao > 0 ? visitsLocacao / monthsElapsed : 0,
        convVisitaLocacao: visitsLocacao > 0 ? (numRentals / visitsLocacao) * 100 : 0,
      };
    });

    return data.sort((a,b) => a.channel.localeCompare(b.channel));
  }, [leads, sales, currentYear, getMappedChannel, normalize]);

  const costData = useMemo(() => {
    return matrixData.rows.map(row => {
      const costConfig = channelCosts[row.channel];
      
      let investmentToDate = 0;
      if (costConfig) {
        if (costConfig.type === 'fixed') {
          const monthlyValue = Number(costConfig.value) || 0;
          let monthsToCount = currentMonth; // Past full months
          if (isLastDay) {
            monthsToCount += 1; // Add current month if it's the last day
          }
          investmentToDate = monthlyValue * monthsToCount;
        } else if (costConfig.type === 'monthly' && Array.isArray(costConfig.value)) {
          investmentToDate = costConfig.value.reduce((acc, monthlyCost, index) => {
            const cost = Number(monthlyCost) || 0;
            if (index < currentMonth) {
              return acc + cost;
            }
            if (index === currentMonth && isLastDay) {
              return acc + cost;
            }
            return acc;
          }, 0);
        }
      }

      // Calculate total deals (sales and rentals) for the channel
      const channelDeals = sales.filter(s => {
        const rawSaleChannel = s.origem || '';
        const saleChannel = getMappedChannel(rawSaleChannel);
        const date = parseDate(s.saleDate);
        return saleChannel === row.channel && date && date.getFullYear() === currentYear;
      });

      const numSales = channelDeals.filter(s => !normalize(s.tipo || '').includes('loca') && !normalize(s.tipo || '').includes('aluguel')).length;
      const numRentals = channelDeals.filter(s => normalize(s.tipo || '').includes('loca') || normalize(s.tipo || '').includes('aluguel')).length;

      const costPerSale = numSales > 0 ? investmentToDate / numSales : 0;
      const costPerRental = numRentals > 0 ? investmentToDate / numRentals : 0;
      
      const totalLeads = row.totalVenda + row.totalLocacao;
      const cplTotal = totalLeads > 0 ? investmentToDate / totalLeads : 0;
      
      return {
        ...row,
        cost: investmentToDate,
        costPerSale,
        costPerRental,
        cplTotal,
        totalLeads: totalLeads
      };
    }).sort((a,b) => a.channel.localeCompare(b.channel));
  }, [matrixData.rows, channelCosts, currentMonth, isLastDay, sales, currentYear, normalize, getMappedChannel]);

  const { rows, monthlyTotals, grandTotalVenda, grandTotalLocacao } = matrixData;

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <Tabs value={view} onValueChange={(v) => setView(v as 'anual' | 'media' | 'custos')}>
        <CardHeader className="bg-muted/5 border-b py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base font-bold text-primary">Leads por Canal ({new Date().getFullYear()})</CardTitle>
            <TabsList className="grid w-[280px] grid-cols-3 h-9 p-1">
                <TabsTrigger value="anual" className="text-xs h-full">Anual</TabsTrigger>
                <TabsTrigger value="media" className="text-xs h-full">Métricas</TabsTrigger>
                <TabsTrigger value="custos" className="text-xs h-full">Custos</TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TabsContent value="anual" className="m-0">
            {rows.length > 0 ? (
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
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Nenhum dado de lead sincronizado para {new Date().getFullYear()}.</p>
                <p className="text-[10px] text-muted-foreground/60 max-w-xs mx-auto">Verifique as colunas "Fonte", "Natureza da Negociação" e "Data" na sua planilha.</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="media" className="m-0">
             {averageData.length > 0 ? (
                <ScrollArea className="w-full">
                  <div className="min-w-[1040px]">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead rowSpan={2} className="w-[140px] text-xs uppercase sticky left-0 bg-background z-10 border-r font-bold">Canal</TableHead>
                                <TableHead colSpan={3} className="text-center bg-emerald-50 text-emerald-800 font-bold text-xs uppercase">Venda</TableHead>
                                <TableHead colSpan={3} className="text-center bg-blue-50 text-blue-800 font-bold text-xs uppercase">Locação</TableHead>
                            </TableRow>
                            <TableRow>
                                <TableHead className="w-[150px] text-center text-xs uppercase bg-emerald-50/50">Leads/mês</TableHead>
                                <TableHead className="w-[150px] text-center text-xs uppercase bg-emerald-50/50">Visitas/mês</TableHead>
                                <TableHead className="w-[150px] text-center text-xs uppercase bg-emerald-50/50">Conv. Visita (%)</TableHead>
                                <TableHead className="w-[150px] text-center text-xs uppercase bg-blue-50/50">Leads/mês</TableHead>
                                <TableHead className="w-[150px] text-center text-xs uppercase bg-blue-50/50">Visitas/mês</TableHead>
                                <TableHead className="w-[150px] text-center text-xs uppercase bg-blue-50/50">Conv. Visita (%)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {averageData.map(row => (
                            <TableRow key={row.channel} className="hover:bg-muted/20">
                                <TableCell className="font-semibold text-xs sticky left-0 bg-background z-10 border-r">{row.channel}</TableCell>
                                <TableCell className="text-center font-medium text-sm">{row.mediaLeadsVenda.toFixed(1)}</TableCell>
                                <TableCell className="text-center font-medium text-sm">{row.mediaVisitasVenda.toFixed(1)}</TableCell>
                                <TableCell className="text-center font-bold text-sm bg-emerald-50/30 text-emerald-700">{row.convVisitaVenda.toFixed(1)}%</TableCell>
                                <TableCell className="text-center font-medium text-sm">{row.mediaLeadsLocacao.toFixed(1)}</TableCell>
                                <TableCell className="text-center font-medium text-sm">{row.mediaVisitasLocacao.toFixed(1)}</TableCell>
                                <TableCell className="text-center font-bold text-sm bg-blue-50/30 text-blue-700">{row.convVisitaLocacao.toFixed(1)}%</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
             ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">Nenhum dado para calcular as métricas.</p>
                    <p className="text-[10px] text-muted-foreground/60 max-w-xs mx-auto">Verifique os dados nas suas planilhas de Leads e Vendas/Locações.</p>
                </div>
             )}
          </TabsContent>
          <TabsContent value="custos" className="m-0">
             {costData.length > 0 ? (
                <ScrollArea className="w-full">
                  <div className="min-w-[1040px]">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px] text-xs uppercase sticky left-0 bg-background z-10 border-r font-bold">Canal</TableHead>
                                <TableHead className="w-[200px] text-center text-xs uppercase">Investimento Acumulado (R$)</TableHead>
                                <TableHead className="text-center text-xs uppercase">Total Leads</TableHead>
                                <TableHead className="text-center text-xs uppercase bg-emerald-50 text-emerald-800">Custo por Venda (R$)</TableHead>
                                <TableHead className="text-center text-xs uppercase bg-blue-50 text-blue-800">Custo por Locação (R$)</TableHead>
                                <TableHead className="text-center text-xs uppercase bg-gray-100">CPL Total (R$)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {costData.map(row => (
                            <TableRow key={row.channel} className="hover:bg-muted/20">
                                <TableCell className="font-semibold text-xs sticky left-0 bg-background z-10 border-r">
                                  <div className="flex items-center justify-between gap-2">
                                    <span>{row.channel}</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenCostDialog(row.channel)}>
                                        <Edit className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-medium text-sm">
                                  {formatCurrency(row.cost)}
                                </TableCell>
                                <TableCell className="text-center font-medium text-sm">{row.totalLeads}</TableCell>
                                <TableCell className="text-center font-bold text-sm bg-emerald-50/60 text-emerald-700">{formatCurrency(row.costPerSale)}</TableCell>
                                <TableCell className="text-center font-bold text-sm bg-blue-50/60 text-blue-700">{formatCurrency(row.costPerRental)}</TableCell>
                                <TableCell className="text-center font-bold text-sm bg-gray-50">{formatCurrency(row.cplTotal)}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
             ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">Nenhum dado para calcular os custos.</p>
                    <p className="text-[10px] text-muted-foreground/60 max-w-xs mx-auto">Aguardando dados das planilhas de Leads.</p>
                </div>
             )}
          </TabsContent>
        </CardContent>
      </Tabs>
      <Dialog open={isCostDialogOpen} onOpenChange={setIsCostDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Custos para: {editingChannel}</DialogTitle>
          </DialogHeader>
          {tempCost && (
            <div className="py-4 space-y-6">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="cost-type-switch" 
                  checked={tempCost.type === 'fixed'}
                  onCheckedChange={handleCostTypeChange}
                />
                <Label htmlFor="cost-type-switch">Custo Fixo Mensal</Label>
              </div>

              {tempCost.type === 'fixed' ? (
                <div className="space-y-2">
                  <Label>Valor Fixo Mensal (R$)</Label>
                  <Input 
                      type="number"
                      placeholder="0.00"
                      value={tempCost.value || ''}
                      onChange={(e) => setTempCost({ type: 'fixed', value: Number(e.target.value) || 0 })}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                    <Label>Valores Mensais (R$)</Label>
                    <ScrollArea className="h-64 border rounded-md p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                            {months.map((month, i) => (
                                <div key={month} className="space-y-1">
                                    <Label htmlFor={`month-${i}`} className="text-xs">{month}</Label>
                                    <Input 
                                        id={`month-${i}`}
                                        type="number"
                                        placeholder="0.00"
                                        value={(Array.isArray(tempCost.value) ? tempCost.value[i] : '') || ''}
                                        onChange={(e) => {
                                            if (Array.isArray(tempCost.value)) {
                                                const newMonthlyValues = [...tempCost.value];
                                                newMonthlyValues[i] = e.target.value === '' ? '' : (Number(e.target.value) || 0);
                                                setTempCost({ type: 'monthly', value: newMonthlyValues });
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCostDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCosts}>Salvar Custos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
