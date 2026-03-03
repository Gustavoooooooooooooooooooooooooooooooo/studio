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

    // Data de referência do app: 02 de Março de 2026
    // Mês passado: Fevereiro de 2026
    const targetMonth = 1; // Fevereiro (0-indexed)
    const targetYear = 2026;

    const parseDate = (d: any) => {
      if (!d) return null;
      if (d instanceof Date) return d;
      
      const cleanStr = String(d).trim();
      if (!cleanStr || cleanStr === "N/A" || cleanStr === "undefined") return null;

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

      // Filtro de Leads e Visitas
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

      // Visitas Realizadas (Compra)
      const visitsRealizedSale = brokerLeads.filter(l => {
        const keys = Object.keys(l);
        const activityStatusKey = keys.find(k => normalize(k).includes("status da atividade atual") || normalize(k).includes("status atividade"));
        const natureKey = keys.find(k => normalize(k).includes("natureza da negociacao") || normalize(k).includes("natureza"));
        if (!activityStatusKey || !natureKey) return false;
        const activityVal = normalize(String(l[activityStatusKey]));
        const natureVal = normalize(String(l[natureKey]));
        return activityVal.includes("realizada") && natureVal.includes("compra");
      });

      // Visitas Realizadas (Aluguel)
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
      
      const validDiffs = bSalesRecords.map(s => {
        const start = parseDate(s.propertyCaptureDate);
        const end = parseDate(s.saleDate);
        if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
          return (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
        }
        return null;
      }).filter(d => d !== null) as number[];

      const avgTime = validDiffs.length > 0 ? validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length : 0;

      return {
        name: displayName,
        leads: leadsMonthPast.length,
        visitsSale: visitsRealizedSale.length,
        visitsRent: visitsRealizedRent.length,
        vProps: vProps.length,
        rProps: rProps.length,
        vgv: totalVgv,
        avgTime
      };
    }).sort((a, b) => b.vgv - a.vgv);
  }, [sales, leads, properties, officialBrokers]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-muted/10">
        <CardTitle className="text-lg font-bold">Performance Real por Corretor</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isBrokersLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : stats.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/5">
                <TableHead className="font-bold">Corretor</TableHead>
                <TableHead className="text-center">Leads (Mês Passado)</TableHead>
                <TableHead className="text-center">Visitas (Compra)</TableHead>
                <TableHead className="text-center">Visitas (Aluguel)</TableHead>
                <TableHead className="text-center">Angariados (V/L)</TableHead>
                <TableHead className="text-right">Tempo Médio</TableHead>
                <TableHead className="text-right font-bold">VGV Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((row) => (
                <TableRow key={row.name} className="hover:bg-muted/5">
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                      {row.leads}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`${row.visitsSale > 0 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'text-muted-foreground/40'}`}>
                      {row.visitsSale}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`${row.visitsRent > 0 ? 'border-blue-200 text-blue-700 bg-blue-50' : 'text-muted-foreground/40'}`}>
                      {row.visitsRent}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <span className={`${row.vProps > 0 ? 'text-amber-600 font-bold' : 'text-muted-foreground/20'}`}>{row.vProps}V</span>
                      <span className={`${row.rProps > 0 ? 'text-purple-600 font-bold' : 'text-muted-foreground/20'}`}>{row.rProps}L</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs">{row.avgTime > 0 ? `${Math.round(row.avgTime)} dias` : "-"}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatCurrency(row.vgv)}</TableCell>
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
