
"use client"

import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Loader2 } from "lucide-react";

interface BrokerPerformanceGridProps {
  sales: any[];
  leads: any[];
  properties: any[];
}

export function BrokerPerformanceGrid({ sales, leads, properties }: BrokerPerformanceGridProps) {
  const { firestore } = useFirebase();
  
  const brokersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "brokers"), orderBy("name", "asc"));
  }, [firestore]);

  const { data: officialBrokers, isLoading: isBrokersLoading } = useCollection(brokersQuery);

  const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const stats = useMemo(() => {
    if (!officialBrokers || officialBrokers.length === 0) return [];

    const targetMonth = 1; // Fevereiro (0-indexed)
    const targetYear = 2026;

    const parseDate = (d: any) => {
      if (!d) return null;
      if (d instanceof Date) return d;
      
      const cleanStr = String(d).trim();
      if (!cleanStr || cleanStr === "N/A" || cleanStr === "undefined" || cleanStr === "") return null;

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
    };

    return officialBrokers.map(brokerDoc => {
      const displayName = brokerDoc.name;
      const normName = normalize(displayName);

      // Métricas de Cadastro (Angariação)
      const bProps = properties.filter(p => {
        const bId = normalize(p.brokerId);
        return bId === normName || bId.includes(normName);
      });
      const vProps = bProps.filter(p => Number(p.saleValue) > 0);
      const rProps = bProps.filter(p => Number(p.rentalValue) > 0);

      // Filtro de Leads
      const brokerLeads = leads.filter(l => {
        const keys = Object.keys(l);
        const brokerKey = keys.find(k => {
          const nk = normalize(k);
          return nk.includes("corretor") || nk.includes("responsavel") || nk.includes("atendente");
        });
        if (!brokerKey) return false;
        const leadBrokerVal = normalize(String(l[brokerKey]));
        return leadBrokerVal && (leadBrokerVal === normName || leadBrokerVal.includes(normName));
      });

      // Leads Mês Passado
      const leadsMonthPast = brokerLeads.filter(l => {
        const keys = Object.keys(l);
        const dateKey = keys.find(k => {
          const nk = normalize(k);
          return nk.includes("data") || nk.includes("carimbo") || nk.includes("criado");
        });
        const date = dateKey ? parseDate(l[dateKey]) : null;
        return date && date.getMonth() === targetMonth && date.getFullYear() === targetYear;
      });

      // Visitas Realizadas
      const visitsRealizedSale = brokerLeads.filter(l => {
        const keys = Object.keys(l);
        const activityStatusKey = keys.find(k => normalize(k).includes("status da atividade atual") || normalize(k).includes("status atividade"));
        const natureKey = keys.find(k => normalize(k).includes("natureza da negociacao") || normalize(k).includes("natureza"));
        if (!activityStatusKey || !natureKey) return false;
        const activityVal = normalize(String(l[activityStatusKey]));
        const natureVal = normalize(String(l[natureKey]));
        return activityVal.includes("realizada") && natureVal.includes("compra");
      });

      const visitsRealizedRent = brokerLeads.filter(l => {
        const keys = Object.keys(l);
        const activityStatusKey = keys.find(k => normalize(k).includes("status da atividade atual") || normalize(k).includes("status atividade"));
        const natureKey = keys.find(k => normalize(k).includes("natureza da negociacao") || normalize(k).includes("natureza"));
        if (!activityStatusKey || !natureKey) return false;
        const activityVal = normalize(String(l[activityStatusKey]));
        const natureVal = normalize(String(l[natureKey]));
        return activityVal.includes("realizada") && (natureVal.includes("locacao") || natureVal.includes("aluguel"));
      });

      // VGV do corretor
      const bSalesRecords = sales.filter(s => {
        const vend = normalize(s.vendedor);
        return vend === normName || vend.includes(normName);
      });
      const totalVgv = bSalesRecords.reduce((acc, s) => acc + (Number(s.closedValue) || 0), 0);
      
      // Nova Lógica de Frequência Venda (Intervalo real entre vendas)
      let avgFrequency = 0;
      const validSaleDates = bSalesRecords
        .map(s => parseDate(s.saleDate))
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      if (validSaleDates.length >= 2) {
        const firstSale = validSaleDates[0];
        const lastSale = validSaleDates[validSaleDates.length - 1];
        const diffMs = lastSale.getTime() - firstSale.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);
        avgFrequency = diffDays / (validSaleDates.length - 1);
      }

      return {
        name: displayName,
        leads: leadsMonthPast.length,
        visitsSale: visitsRealizedSale.length,
        visitsRent: visitsRealizedRent.length,
        vProps: vProps.length,
        rProps: rProps.length,
        vgv: totalVgv,
        avgFrequency
      };
    }).sort((a, b) => b.vgv - a.vgv);
  }, [sales, leads, properties, officialBrokers]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-muted/10 border-b py-3">
        <CardTitle className="text-base font-bold text-primary">Performance Real por Corretor</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isBrokersLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : stats.length > 0 ? (
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-muted/5">
                <TableHead className="font-bold border-r text-xs uppercase">Corretor</TableHead>
                <TableHead className="text-center border-r text-xs uppercase">Leads (Mês Ant.)</TableHead>
                <TableHead className="text-center border-r text-xs uppercase">Visitas (Compra)</TableHead>
                <TableHead className="text-center border-r text-xs uppercase">Visitas (Aluguel)</TableHead>
                <TableHead className="text-center border-r text-xs uppercase">Angariados</TableHead>
                <TableHead className="text-right border-r text-xs uppercase">Frequência Venda</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase bg-primary/5">VGV Total</TableHead>
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
                    <span className={`text-xs font-bold ${row.visitsSale > 0 ? 'text-emerald-600' : 'text-muted-foreground/20'}`}>
                      {row.visitsSale}
                    </span>
                  </TableCell>
                  <TableCell className="text-center border-r py-2">
                    <span className={`text-xs font-bold ${row.visitsRent > 0 ? 'text-blue-600' : 'text-muted-foreground/20'}`}>
                      {row.visitsRent}
                    </span>
                  </TableCell>
                  <TableCell className="text-center border-r py-2">
                    <div className="flex items-center justify-center gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <span className={`font-black ${row.vProps > 0 ? 'text-emerald-600' : 'text-muted-foreground/10'}`}>{row.vProps}</span>
                      </div>
                      <div className="w-[1px] h-4 bg-muted/20" />
                      <div className="flex flex-col items-center">
                        <span className={`font-black ${row.rProps > 0 ? 'text-blue-600' : 'text-muted-foreground/10'}`}>{row.rProps}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right border-r py-2 text-[10px] text-muted-foreground font-medium">
                    {row.avgFrequency > 0 ? `${Math.round(row.avgFrequency)} dias` : "-"}
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
            <p className="text-sm font-medium">Nenhum corretor configurado.</p>
            <p className="text-xs">Vá na aba "Config" para cadastrar os corretores oficiais.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
