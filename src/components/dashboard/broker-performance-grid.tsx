
'use client';

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
    
    // BASE DE CÁLCULO FIXA: 427 dias (01/01/2025 até 02/03/2026)
    const totalDaysCount = 427;

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

      // 1. Angariações
      const bProps = properties.filter(p => {
        const bId = normalize(p.brokerId || p.angariador || "");
        return bId === normName || bId.includes(normName);
      });
      const vPropsCount = bProps.filter(p => Number(p.saleValue || p.valorVenda) > 0).length;

      // 2. Leads (Fev/26)
      const brokerLeads = leads.filter(l => {
        const keys = Object.keys(l);
        const brokerKey = keys.find(k => {
          const nk = normalize(k);
          return nk.includes("corretor") || nk.includes("responsavel") || nk.includes("atendente");
        });
        if (!brokerKey) return false;
        return normalize(String(l[brokerKey])) === normName;
      });

      const leadsMonthCount = brokerLeads.filter(l => {
        const keys = Object.keys(l);
        const dateKey = keys.find(k => {
          const nk = normalize(k);
          return nk.includes("data") || nk.includes("carimbo") || nk.includes("criado");
        });
        const date = dateKey ? parseDate(l[dateKey]) : null;
        return date && date.getMonth() === targetMonth && date.getFullYear() === targetYear;
      }).length;

      // 3. VENDAS (Aba Conclusão)
      const brokerSales = sales.filter(s => {
        const seller = normalize(s.vendedor || s.corretor || s.vendas || s.venda || "");
        return seller === normName || seller.includes(normName);
      });
      
      const numSales = brokerSales.length;
      const totalVgv = brokerSales.reduce((acc, s) => acc + (Number(s.closedValue || s.valorVenda) || 0), 0);
      
      // 4. CÁLCULO DA FREQUÊNCIA: 427 / Vendas (Floor)
      const avgFrequency = numSales > 0 ? Math.floor(totalDaysCount / numSales) : 0;

      return {
        name: displayName,
        leads: leadsMonthCount,
        vProps: vPropsCount,
        numSales,
        vgv: totalVgv,
        avgFrequency
      };
    }).sort((a, b) => b.numSales - a.numSales || b.vgv - a.vgv);
  }, [sales, leads, properties, officialBrokers]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-muted/10 border-b py-3">
        <CardTitle className="text-base font-bold text-primary">Performance Real por Corretor (Desde 01/01/2025)</CardTitle>
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
                <TableHead className="text-center border-r text-xs uppercase">Leads (Fev/26)</TableHead>
                <TableHead className="text-center border-r text-xs uppercase">Angariados</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-primary/5">Vendas</TableHead>
                <TableHead className="text-right border-r text-xs uppercase bg-amber-50/30">Frequência Venda</TableHead>
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
                    <span className={`font-black text-xs ${row.vProps > 0 ? 'text-emerald-600' : 'text-muted-foreground/10'}`}>
                      {row.vProps}
                    </span>
                  </TableCell>
                  <TableCell className="text-center border-r py-2 text-sm font-bold bg-primary/5 text-primary">
                    {row.numSales}
                  </TableCell>
                  <TableCell className="text-right border-r py-2 text-xs font-bold text-amber-700 bg-amber-50/20">
                    {row.numSales > 0 ? `${row.avgFrequency} dias` : "-"}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
