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
      if (typeof d === 'string') {
        const parts = d.split('/');
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2]);
          return new Date(year, Number(parts[1]) - 1, Number(parts[0]));
        }
        return new Date(d);
      }
      // Excel Serial
      const num = parseFloat(String(d).replace(',', '.'));
      if (!isNaN(num) && num > 40000 && num < 60000) {
        return new Date(Math.round((num - 25569) * 86400 * 1000));
      }
      return null;
    };

    return officialBrokers.map(brokerDoc => {
      const displayName = brokerDoc.name;
      const normName = normalize(displayName);

      // Métricas de Vendas/Locações
      const bSalesRecords = sales.filter(s => normalize(s.vendedor) === normName);
      const vSales = bSalesRecords.filter(s => normalize(s.tipoVenda).includes("venda"));
      const rSales = bSalesRecords.filter(s => normalize(s.tipoVenda).includes("locacao") || normalize(s.tipoVenda).includes("aluguel"));

      // Métricas de Cadastro (Angariação)
      const bProps = properties.filter(p => normalize(p.brokerId) === normName);
      const vProps = bProps.filter(p => Number(p.saleValue) > 0);
      const rProps = bProps.filter(p => Number(p.rentalValue) > 0);

      // Métricas de Leads - FILTRO MÊS PASSADO (Fevereiro 2026)
      const bLeads = leads.filter(l => {
        const keys = Object.keys(l);
        const brokerKey = keys.find(k => normalize(k).includes("corretor"));
        const nameMatch = brokerKey && normalize(l[brokerKey]) === normName;
        
        if (!nameMatch) return false;

        const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo"));
        const date = dateKey ? parseDate(l[dateKey]) : null;
        
        return date && date.getMonth() === targetMonth && date.getFullYear() === targetYear;
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
        leads: bLeads.length,
        vSales: vSales.length,
        rSales: rSales.length,
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
                <TableHead className="text-center">Fechamentos (V/L)</TableHead>
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
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">{row.leads}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <span className={`${row.vSales > 0 ? 'text-emerald-600 font-bold' : 'text-muted-foreground/20'}`}>{row.vSales}V</span>
                      <span className={`${row.rSales > 0 ? 'text-blue-600 font-bold' : 'text-muted-foreground/20'}`}>{row.rSales}L</span>
                    </div>
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
