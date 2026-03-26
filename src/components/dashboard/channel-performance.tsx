
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Edit, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";


interface ChannelPerformanceProps {
  leads: any[];
  sales: any[];
  selectedMonths: string[];
  selectedYears: string[];
}

type ChannelCost = { type: 'fixed'; value: number } | { type: 'monthly'; value: (number | string)[] };


export function ChannelPerformance({ leads, sales, selectedMonths, selectedYears }: ChannelPerformanceProps) {
  const [view, setView] = useState<'anual' | 'media' | 'custos' | 'negocios'>('anual');
  const [channelCosts, setChannelCosts] = useState<Record<string, ChannelCost>>({});
  const [isCostDialogOpen, setIsCostDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [tempCost, setTempCost] = useState<ChannelCost | null>(null);

  const allowedCostChannels = ['C2sbot', 'Chaves na Mão', 'Grupo Zap', 'Imóvel Web', 'Meta', 'Site'];

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const now = new Date();

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
  
  const filterByPeriod = useCallback((date: Date | null) => {
      if (!date) return false;
      const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(String(date.getUTCMonth()));
      const yearMatch = selectedYears.length === 0 || selectedYears.includes(String(date.getUTCFullYear()));
      return monthMatch && yearMatch;
  }, [selectedMonths, selectedYears]);

  const yearToDisplay = selectedYears.length > 0 ? parseInt(selectedYears[0], 10) : now.getFullYear();

  const allChannels = useMemo(() => {
      const leadChannels = leads.map(lead => {
        const keys = Object.keys(lead);
        const sourceKey = keys.find(k => normalize(k) === "fonte" || normalize(k).includes("fonte") || normalize(k) === "origem" || normalize(k).includes("origem") || normalize(k) === "canal");
        return getMappedChannel(sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação");
      });
      const saleChannels = sales.map(sale => getMappedChannel(sale.origem || ''));
      const costChannels = Object.keys(channelCosts).map(c => getMappedChannel(c));

      return Array.from(new Set([...leadChannels, ...saleChannels, ...costChannels]))
          .filter(c => c && c.toLowerCase() !== 'n/a' && c !== "undefined" && c !== "null" && c !== "")
          .sort();
  }, [leads, sales, channelCosts, getMappedChannel, normalize]);
  
  const processedData = useMemo(() => {
    const data: Record<string, { 
        monthlyLeadsVenda: number[], 
        monthlyLeadsLocacao: number[],
        totalLeadsVenda: number,
        totalLeadsLocacao: number,
        totalVisitsVenda: number,
        totalVisitsLocacao: number,
        totalSales: number,
        totalRentals: number
    }> = {};

    allChannels.forEach(channel => {
      data[channel] = {
        monthlyLeadsVenda: Array(12).fill(0),
        monthlyLeadsLocacao: Array(12).fill(0),
        totalLeadsVenda: 0,
        totalLeadsLocacao: 0,
        totalVisitsVenda: 0,
        totalVisitsLocacao: 0,
        totalSales: 0,
        totalRentals: 0,
      };
    });

    leads.forEach(lead => {
      const keys = Object.keys(lead);
      const sourceKey = keys.find(k => normalize(k) === "fonte" || normalize(k).includes("fonte") || normalize(k) === "origem" || normalize(k).includes("origem") || normalize(k) === "canal");
      const channel = getMappedChannel(sourceKey && lead[sourceKey] ? String(lead[sourceKey]).trim() : "Direto/Indicação");
      
      if (!data[channel]) return;
      
      const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo") || normalize(k).includes("criado"));
      const date = dateKey ? parseDate(lead[dateKey]) : null;
      
      const natureKey = keys.find(k => normalize(k).includes("natureza") || normalize(k).includes("negociacao"));
      const isLocacao = natureKey && lead[natureKey] ? (normalize(lead[natureKey]).includes("loca") || normalize(lead[natureKey]).includes("alug")) : false;
      
      const hasVisit = Object.entries(lead).some(([key, val]) => {
          const nk = normalize(key);
          const nv = normalize(String(val || ""));
          return (nk.includes("status da atividade atual") || nk.includes("visit")) && (nv.includes("realizada") || nv.includes("sim"));
      });
      
      if (filterByPeriod(date)) {
        if (isLocacao) {
          data[channel].totalLeadsLocacao++;
          if (hasVisit) data[channel].totalVisitsLocacao++;
        } else {
          data[channel].totalLeadsVenda++;
          if (hasVisit) data[channel].totalVisitsVenda++;
        }
      }

      if (date && date.getFullYear() === yearToDisplay) {
        const month = date.getMonth();
        if (isLocacao) {
          data[channel].monthlyLeadsLocacao[month]++;
        } else {
          data[channel].monthlyLeadsVenda[month]++;
        }
      }
    });

    sales.forEach(sale => {
      const channel = getMappedChannel(sale.origem || '');
      if (!data[channel]) return;

      const date = parseDate(sale.saleDate);
      if (filterByPeriod(date)) {
        const tipo = normalize(sale.tipo || '');
        if (tipo === 'venda') {
          data[channel].totalSales++;
        } else if (tipo.includes('loca') || tipo.includes('aluguel')) {
          data[channel].totalRentals++;
        }
      }
    });

    return data;
  }, [allChannels, leads, sales, yearToDisplay, filterByPeriod, getMappedChannel, normalize]);
  
  const matrixData = useMemo(() => {
      const rows = allChannels.map(channel => ({
        channel,
        venda: processedData[channel]?.monthlyLeadsVenda || Array(12).fill(0),
        locacao: processedData[channel]?.monthlyLeadsLocacao || Array(12).fill(0),
        totalVenda: processedData[channel]?.monthlyLeadsVenda.reduce((a,b) => a+b, 0) || 0,
        totalLocacao: processedData[channel]?.monthlyLeadsLocacao.reduce((a,b) => a+b, 0) || 0
      })).filter(r => (r.totalVenda + r.totalLocacao) > 0);

      const monthlyTotals = {
        venda: Array(12).fill(0),
        locacao: Array(12).fill(0),
      };
      rows.forEach(row => {
        row.venda.forEach((v, i) => monthlyTotals.venda[i] += v);
        row.locacao.forEach((l, i) => monthlyTotals.locacao[i] += l);
      });

      const grandTotalVenda = monthlyTotals.venda.reduce((a,b) => a+b, 0);
      const grandTotalLocacao = monthlyTotals.locacao.reduce((a,b) => a+b, 0);

      return { rows, monthlyTotals, grandTotalVenda, grandTotalLocacao };
  }, [allChannels, processedData]);


  const monthsElapsed = useMemo(() => {
    let monthsToAverage = 1;
    const currentYear = now.getUTCFullYear();
    const currentMonthIndex = now.getUTCMonth();

    if (selectedYears.length > 0) {
        if (selectedMonths.length > 0) {
            monthsToAverage = selectedYears.length * selectedMonths.length;
        } else {
            monthsToAverage = selectedYears.reduce((acc, yearStr) => {
                const year = parseInt(yearStr);
                if (year < currentYear) return acc + 12;
                if (year === currentYear) return acc + currentMonthIndex; // Only past full months
                return acc;
            }, 0);
        }
    } else { // No year selected, assume current year
        if (selectedMonths.length > 0) {
            monthsToAverage = selectedMonths.filter(m => parseInt(m) < currentMonthIndex).length;
        } else {
            monthsToAverage = currentMonthIndex;
        }
    }
    return Math.max(1, monthsToAverage);
  }, [selectedYears, selectedMonths, now]);
  
  const averageData = useMemo(() => {
    return allChannels.map(channel => {
      const data = processedData[channel];
      return {
        channel,
        mediaLeadsVenda: data.totalLeadsVenda / monthsElapsed,
        mediaVisitasVenda: data.totalVisitsVenda / monthsElapsed,
        convVisitaVenda: data.totalVisitsVenda > 0 ? (data.totalSales / data.totalVisitsVenda) * 100 : 0,
        mediaLeadsLocacao: data.totalLeadsLocacao / monthsElapsed,
        mediaVisitasLocacao: data.totalVisitsLocacao / monthsElapsed,
        convVisitaLocacao: data.totalVisitsLocacao > 0 ? (data.totalRentals / data.totalVisitsLocacao) * 100 : 0,
      };
    });
  }, [allChannels, processedData, monthsElapsed]);
  
  const costData = useMemo(() => {
    const lastDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    return allChannels.map(channel => {
        const data = processedData[channel];
        
        let investmentForPeriod = 0;
        
        const matchingCostKeys = Object.keys(channelCosts).filter(
          originalKey => getMappedChannel(originalKey) === channel
        );

        if (matchingCostKeys.length > 0) {
            const years = selectedYears.length > 0 ? selectedYears.map(y => parseInt(y)) : [now.getFullYear()];
            const months = selectedMonths.length > 0 ? selectedMonths.map(m => parseInt(m)) : Array.from(Array(12).keys());
            
            matchingCostKeys.forEach(key => {
              const costConfig = channelCosts[key];
              if (costConfig) {
                years.forEach(year => {
                    months.forEach(month => {
                        const dateOfCost = new Date(year, month, 1);
                        if (dateOfCost <= lastDayOfPreviousMonth) {
                            if (costConfig.type === 'fixed') {
                                investmentForPeriod += Number(costConfig.value) || 0;
                            } else if (costConfig.type === 'monthly' && Array.isArray(costConfig.value)) {
                                investmentForPeriod += Number(costConfig.value[month]) || 0;
                            }
                        }
                    });
                });
              }
            });
        }

        const totalDeals = data.totalSales + data.totalRentals;
        const costPerDeal = totalDeals > 0 ? investmentForPeriod / totalDeals : 0;
        
        const totalLeads = data.totalLeadsVenda + data.totalLeadsLocacao;
        const cplTotal = totalLeads > 0 ? investmentForPeriod / totalLeads : 0;

        return {
            channel,
            cost: investmentForPeriod,
            totalLeads,
            costPerDeal,
            cplTotal,
        };
    });
  }, [allChannels, processedData, channelCosts, selectedYears, selectedMonths, now, getMappedChannel]);

  const costTotals = useMemo(() => {
    const dataToTotal = costData.filter(row => allowedCostChannels.includes(row.channel));

    const totalInvestment = dataToTotal.reduce((acc, row) => acc + row.cost, 0);
    const totalLeads = dataToTotal.reduce((acc, row) => acc + row.totalLeads, 0);
    
    const totalDeals = dataToTotal.reduce((acc, row) => {
        const channelData = processedData[row.channel];
        if (channelData) {
            return acc + channelData.totalSales + channelData.totalRentals;
        }
        return acc;
    }, 0);

    const avgCostPerDeal = totalDeals > 0 ? totalInvestment / totalDeals : 0;
    const avgCplTotal = totalLeads > 0 ? totalInvestment / totalLeads : 0;

    return {
        totalInvestment,
        totalLeads,
        avgCostPerDeal,
        avgCplTotal,
    };
  }, [costData, allowedCostChannels, processedData]);

  const { rows, monthlyTotals, grandTotalVenda, grandTotalLocacao } = matrixData;

  const dealsByChannelData = useMemo(() => {
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
  }, [sales, yearToDisplay, getMappedChannel, normalize, allChannels]);

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <Tabs value={view} onValueChange={(v) => setView(v as 'anual' | 'media' | 'custos' | 'negocios')}>
        <CardHeader className="bg-muted/5 border-b py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base font-bold text-primary">Análise por Canal ({yearToDisplay})</CardTitle>
            <TabsList className="grid w-[380px] grid-cols-4 h-9 p-1">
                <TabsTrigger value="anual" className="text-xs h-full">Leads</TabsTrigger>
                <TabsTrigger value="negocios" className="text-xs h-full">Negócios</TabsTrigger>
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
                <p className="text-sm text-muted-foreground font-medium">Nenhum dado de lead sincronizado para {yearToDisplay}.</p>
                <p className="text-[10px] text-muted-foreground/60 max-w-xs mx-auto">Verifique as colunas "Fonte", "Natureza da Negociação" e "Data" na sua planilha.</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="negocios" className="m-0">
             {dealsByChannelData.rows.length > 0 ? (
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
                            {dealsByChannelData.rows.map(row => (
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
                                    <span className="text-emerald-600 font-extrabold text-[10px]">{dealsByChannelData.monthlyTotals.vendas[i]}</span>
                                    <div className="h-[1px] w-4 bg-primary/10 my-0.5" />
                                    <span className="text-blue-600 font-extrabold text-[10px]">{dealsByChannelData.monthlyTotals.locacoes[i]}</span>
                                    </div>
                                </TableCell>
                                ))}
                                <TableCell className="text-right py-1 px-2 bg-primary/10 sticky right-0 z-10">
                                <div className="flex flex-col items-end leading-[1.1]">
                                    <span className="text-emerald-600 font-extrabold text-[10px]">{dealsByChannelData.grandTotalVendas}</span>
                                    <div className="h-[1px] w-4 bg-primary/10 my-0.5" />
                                    <span className="text-blue-600 font-extrabold text-[10px]">{dealsByChannelData.grandTotalLocacoes}</span>
                                </div>
                                </TableCell>
                            </TableRow>
                            <TableRow className="bg-primary/10">
                                <TableCell className="font-bold text-[10px] py-2 px-2 sticky left-0 bg-primary/10 z-10 border-r text-primary">
                                SOMA TOTAL
                                </TableCell>
                                {months.map((_, i) => (
                                <TableCell key={i} className="text-center py-2 px-1 border-r font-extrabold text-primary text-[11px]">
                                    {dealsByChannelData.monthlyTotals.vendas[i] + dealsByChannelData.monthlyTotals.locacoes[i]}
                                </TableCell>
                                ))}
                                <TableCell className="text-right py-2 px-2 bg-primary/20 sticky right-0 z-10 font-black text-primary text-[11px]">
                                {dealsByChannelData.grandTotalVendas + dealsByChannelData.grandTotalLocacoes}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
             ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">Nenhum negócio fechado para {yearToDisplay}.</p>
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
                                <TableHead className="text-center text-xs uppercase bg-emerald-50 text-emerald-800">Custo de Negócio Fechado (R$)</TableHead>
                                <TableHead className="text-center text-xs uppercase bg-gray-100">CPL Total (R$)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {costData.filter(row => allowedCostChannels.includes(row.channel)).map(row => (
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
                                <TableCell className="text-center font-bold text-sm bg-emerald-50/60 text-emerald-700">{formatCurrency(row.costPerDeal)}</TableCell>
                                <TableCell className="text-center font-bold text-sm bg-gray-50">{formatCurrency(row.cplTotal)}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                        <TableFooter className="bg-primary/5 border-t-2 border-primary/10">
                            <TableRow className="font-bold">
                                <TableCell className="sticky left-0 bg-primary/5 z-10 border-r text-primary">Total</TableCell>
                                <TableCell className="text-center text-sm text-primary">{formatCurrency(costTotals.totalInvestment)}</TableCell>
                                <TableCell className="text-center text-sm text-primary">{costTotals.totalLeads}</TableCell>
                                <TableCell className="text-center text-sm bg-emerald-50/60 text-emerald-800">{formatCurrency(costTotals.avgCostPerDeal)}</TableCell>
                                <TableCell className="text-center text-sm bg-gray-100">{formatCurrency(costTotals.avgCplTotal)}</TableCell>
                            </TableRow>
                        </TableFooter>
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
                      onChange={(e) => {
                          const value = e.target.value;
                          setTempCost({ type: 'fixed', value: value === '' ? 0 : Number(value) });
                      }}
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
                                        value={(Array.isArray(tempCost.value) ? tempCost.value[i] : '')}
                                        onChange={(e) => {
                                            if (Array.isArray(tempCost.value)) {
                                                const newMonthlyValues = [...tempCost.value];
                                                newMonthlyValues[i] = e.target.value;
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
