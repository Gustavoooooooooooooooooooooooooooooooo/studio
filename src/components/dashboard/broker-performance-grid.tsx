
'use client';

import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BrokerPerformanceGridProps {
  sales: any[];
  leads: any[];
  properties: any[];
  selectedMonth: string;
  selectedYear: string;
  brokers: string[];
}

export function BrokerPerformanceGrid({ sales, leads, properties, selectedMonth, selectedYear, brokers }: BrokerPerformanceGridProps) {
  
  const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const parseDate = (d: any) => {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    const strVal = String(d).trim();
    if (!strVal || ["n/a", "undefined", "null", ""].includes(strVal.toLowerCase())) return null;

    // 1. Tentar DD/MM/YYYY ou DD.MM.YYYY ou DD-MM-YYYY
    const dmyMatch = strVal.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;
      const date = new Date(Date.UTC(year, month, day)); // Use UTC
      if (!isNaN(date.getTime())) return date;
    }

    // 2. Tentar ISO YYYY-MM-DD
    const isoMatch = strVal.match(/^(\d{4})[./-](\d{2})[./-](\d{2})/);
    if (isoMatch) {
      const date = new Date(Date.UTC(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10))); // Use UTC
      if (!isNaN(date.getTime())) return date;
    }

    // 3. Serial Excel
    const cleanNumStr = strVal.replace(/[^\d]/g, '');
    const num = Number(cleanNumStr);
    if (!isNaN(num) && num > 40000 && num < 60000 && !strVal.includes('/') && !strVal.includes('-') && !strVal.includes('.')) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) return date;
    }

    const date = new Date(strVal);
    return isNaN(date.getTime()) ? null : date;
  };

  const stats = useMemo(() => {
    if (!brokers || brokers.length === 0) return [];

    const totalDaysCount = 427;

    return brokers.map(brokerName => {
      const normName = normalize(brokerName);

      const filterByPeriod = (item: any, dateField: string) => {
        const d = parseDate(item[dateField]);
        if (!d) return false;
        const monthMatch = selectedMonth === "all" || d.getUTCMonth() === parseInt(selectedMonth); // Use UTC
        const yearMatch = selectedYear === "all" || d.getUTCFullYear() === parseInt(selectedYear); // Use UTC
        return monthMatch && yearMatch;
      };

      // 1. Angariações Filtradas
      const bProps = properties.filter(p => normalize(p.brokerId) === normName);
      const bPropsFiltered = bProps.filter(p => filterByPeriod(p, "captureDate"));
      
      const capturesCount = bPropsFiltered.length;

      // 2. Leads & Visitas
      const brokerLeads = leads.filter(l => {
        if (!l) return false;
        const entries = Object.entries(l);
        return entries.some(([key, val]) => {
          const nk = normalize(key);
          const nv = normalize(String(val || ""));
          // Chaves abrangentes para identificar o corretor em qualquer coluna na planilha de leads.
          const isBrokerColumn = nk.includes("corretor") || nk.includes("responsavel") || nk.includes("atendente") || nk.includes("vendedor") || nk.includes("broker");
          if (isBrokerColumn) {
             return nv.split(' ')[0] === normName.split(' ')[0];
          }
          return false;
        });
      });

      const brokerLeadsFiltered = brokerLeads.filter(l => {
        const keys = Object.keys(l);
        const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo"));
        return dateKey ? filterByPeriod(l, dateKey) : true;
      });

      let visitsVenda = 0;
      let visitsLocacao = 0;

      brokerLeadsFiltered.forEach(l => {
        const entries = Object.entries(l);
        const hasVisit = entries.some(([key, val]) => {
          const nk = normalize(key);
          const nv = normalize(String(val || ""));
          return nk.includes("status da atividade atual") && nv.includes("realizada");
        });

        if (hasVisit) {
          const isLocacao = entries.some(([key, val]) => {
            const nk = normalize(key);
            const nv = normalize(String(val || ""));
            return (nk.includes("natureza") || nk.includes("negociacao") || nk === "tipo") && 
                   (nv.includes("loca") || nv.includes("alug"));
          });
          if (isLocacao) visitsLocacao++;
          else visitsVenda++;
        }
      });

      // 3. Vendas
      const brokerSalesAll = sales.filter(s => normalize(s.vendedor).split(' ')[0] === normName.split(' ')[0]);
      const brokerSalesFiltered = brokerSalesAll.filter(s => filterByPeriod(s, "saleDate"));
      
      const numSalesFiltered = brokerSalesFiltered.length;
      const totalVgvFiltered = brokerSalesFiltered.reduce((acc, s) => acc + (Number(s.closedValue) || 0), 0);
      
      const numSalesTotal = brokerSalesAll.length;
      const avgFrequency = numSalesTotal > 0 ? Math.floor(totalDaysCount / numSalesTotal) : 0;

      const totalVisitsFiltered = visitsVenda + visitsLocacao;
      
      const leadsPerVisit = totalVisitsFiltered > 0 ? (brokerLeadsFiltered.length / totalVisitsFiltered) : 0;
      const conversionLeadsToVisit = brokerLeadsFiltered.length > 0 ? (totalVisitsFiltered / brokerLeadsFiltered.length) * 100 : 0;
      
      const leadsPerSale = numSalesFiltered > 0 ? (brokerLeadsFiltered.length / numSalesFiltered) : 0;
      const conversionLeadsToSale = brokerLeadsFiltered.length > 0 ? (numSalesFiltered / brokerLeadsFiltered.length) * 100 : 0;

      const visitsPerSale = numSalesFiltered > 0 ? (totalVisitsFiltered / numSalesFiltered) : 0;
      const conversionVisitToSale = totalVisitsFiltered > 0 ? (numSalesFiltered / totalVisitsFiltered) * 100 : 0;

      return {
        name: brokerName,
        captures: capturesCount,
        leads: brokerLeadsFiltered.length,
        visitsVenda,
        visitsLocacao,
        totalVisits: totalVisitsFiltered,
        leadsPerVisit,
        conversionLeadsToVisit,
        numSales: numSalesFiltered,
        leadsPerSale,
        conversionLeadsToSale,
        visitsPerSale,
        conversionVisitToSale,
        vgv: totalVgvFiltered,
        avgFrequency
      };
    }).sort((a, b) => b.numSales - a.numSales || b.vgv - a.vgv);
  }, [sales, leads, properties, brokers, selectedMonth, selectedYear]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-muted/10 border-b py-3">
        <CardTitle className="text-base font-bold text-primary">Performance por Corretor</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {stats.length > 0 ? (
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-muted/5">
                <TableHead className="font-bold border-r text-xs uppercase">Corretor</TableHead>
                <TableHead className="text-center border-r text-xs uppercase">Leads Atendidos</TableHead>
                <TableHead className="text-center border-r text-xs uppercase">Angariados</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-indigo-50/20">Visitas Venda</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-blue-50/20">Visitas Locação</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-emerald-50/20 relative">
                   <span className="absolute top-1 left-1 text-[8px] opacity-40">%</span>
                   Leads / Visita
                </TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-primary/5">Vendas</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-orange-50/10 relative">
                   <span className="absolute top-1 left-1 text-[8px] opacity-40">%</span>
                   Leads / Venda
                </TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-rose-50/10 relative">
                   <span className="absolute top-1 left-1 text-[8px] opacity-40">%</span>
                   Visitas / Venda
                </TableHead>
                <TableHead className="text-right border-r text-xs uppercase bg-amber-50/20">Frequência Venda (Total)</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase bg-primary/5">VGV Período</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((row) => (
                <TableRow key={row.name} className="hover:bg-muted/5">
                  <TableCell className="font-semibold border-r text-sm py-2">{row.name}</TableCell>
                  <TableCell className="text-center border-r py-2">
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 shadow-none border-none text-[10px]">
                      {row.leads}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center border-r py-2">
                    <Badge variant="outline" className={`border-emerald-200 text-emerald-700 text-xs font-bold ${row.captures === 0 && 'opacity-20'}`}>
                      {row.captures}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center border-r py-2 bg-indigo-50/10">
                    <Badge variant="outline" className={`border-indigo-200 text-indigo-700 text-[10px] ${row.visitsVenda === 0 && 'opacity-20'}`}>
                      {row.visitsVenda}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center border-r py-2 bg-blue-50/10">
                    <Badge variant="outline" className={`border-blue-200 text-blue-700 text-[10px] ${row.visitsLocacao === 0 && 'opacity-20'}`}>
                      {row.visitsLocacao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center border-r py-2 bg-emerald-50/10 relative">
                    {row.totalVisits > 0 ? (
                      <div className="flex flex-col items-center justify-center h-full pt-1">
                        <span className="absolute top-1 left-1 text-[8px] font-bold text-emerald-600 opacity-60">
                          {row.conversionLeadsToVisit.toFixed(1)}%
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700">
                          {row.leadsPerVisit.toFixed(1)}
                        </span>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-center border-r py-2 text-sm font-bold bg-primary/5 text-primary">
                    {row.numSales}
                  </TableCell>
                  <TableCell className="text-center border-r py-2 bg-orange-50/10 text-[10px] font-bold text-orange-700 relative">
                    {row.numSales > 0 ? (
                      <div className="flex flex-col items-center justify-center h-full pt-1">
                        <span className="absolute top-1 left-1 text-[8px] font-bold text-orange-600 opacity-60">
                          {row.conversionLeadsToSale.toFixed(1)}%
                        </span>
                        <span className="text-[10px] font-bold text-orange-700">
                          {row.leadsPerSale.toFixed(1)}
                        </span>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-center border-r py-2 bg-rose-50/10 text-[10px] font-bold text-rose-700 relative">
                    {row.numSales > 0 && row.totalVisits > 0 ? (
                      <div className="flex flex-col items-center justify-center h-full pt-1">
                        <span className="absolute top-1 left-1 text-[8px] font-bold text-rose-600 opacity-60">
                          {row.conversionVisitToSale.toFixed(1)}%
                        </span>
                        <span className="text-[10px] font-bold text-rose-700">
                          {row.visitsPerSale.toFixed(1)}
                        </span>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right border-r py-2 text-xs font-bold text-amber-700 bg-amber-50/20">
                    {row.avgFrequency > 0 ? `${row.avgFrequency} dias` : "-"}
                  </TableCell>
                  <TableCell className="text-right py-2 font-bold text-primary bg-primary/5 text-sm">
                    {formatCurrency(row.vgv)}
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
      </CardContent>
    </Card>
  );
}

    

    

    
