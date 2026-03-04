
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

  const parseDate = (val: any) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    
    const strVal = String(val).trim();
    
    // Excel Serial
    const cleanStr = strVal.replace(/[^\d]/g, '');
    const num = Number(cleanStr);
    if (!isNaN(num) && num > 40000 && num < 60000 && !strVal.includes('/') && !strVal.includes('-')) {
      return new Date(Math.round((num - 25569) * 86400 * 1000));
    }

    // Brasileiro DD/MM/YYYY
    const brMatch = strVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (brMatch) {
      const day = parseInt(brMatch[1], 10);
      const month = parseInt(brMatch[2], 10) - 1;
      let year = parseInt(brMatch[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }

    // ISO YYYY-MM-DD
    const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(strVal);
    return isNaN(d.getTime()) ? null : d;
  };

  const stats = useMemo(() => {
    if (!officialBrokers || officialBrokers.length === 0) return [];

    const totalDaysCount = 427; // Fixo: 01/01/2025 até 02/03/2026
    const targetMonth = 1; // Fevereiro
    const targetYear = 2026;

    return officialBrokers.map(brokerDoc => {
      const normName = normalize(brokerDoc.name);

      // Filtro rigoroso na aba Conclusão (sales)
      const brokerSales = sales.filter(s => {
        const type = normalize(s.tipoVenda || s.tipo || "");
        if (!type.includes('venda')) return false;
        
        const seller = normalize(s.vendedor || s.corretor || s.venda || "");
        return seller === normName;
      });
      
      // Deduplicação por código para garantir contagem real (Mila: 8, João: 5, Henrique: 4, Claudia: 3)
      const uniqueProps = new Set();
      brokerSales.forEach(s => {
        const code = normalize(s.propertyCode || "");
        if (code && code !== "undefined") uniqueProps.add(code);
      });

      const numSales = uniqueProps.size;
      const avgFrequency = numSales > 0 ? Math.floor(totalDaysCount / numSales) : 0;
      const totalVgv = brokerSales.reduce((acc, s) => acc + (Number(s.closedValue) || 0), 0);

      // Angariações (Estoque)
      const bProps = properties.filter(p => normalize(p.brokerId || "") === normName);
      const vProps = bProps.filter(p => Number(p.saleValue) > 0).length;
      const rProps = bProps.filter(p => Number(p.rentalValue) > 0).length;

      // Leads (Fev/26)
      const brokerLeads = leads.filter(l => {
        const keys = Object.keys(l);
        const brokerKey = keys.find(k => {
          const nk = normalize(k);
          return nk.includes("corretor") || nk.includes("responsavel") || nk.includes("atendente");
        });
        if (!brokerKey) return false;
        return normalize(String(l[brokerKey])) === normName;
      });

      const leadsMonthPast = brokerLeads.filter(l => {
        const keys = Object.keys(l);
        const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo"));
        const date = dateKey ? parseDate(l[dateKey]) : null;
        return date && date.getMonth() === targetMonth && date.getFullYear() === targetYear;
      }).length;

      return {
        name: brokerDoc.name,
        leads: leadsMonthPast,
        vProps,
        rProps,
        numSales,
        vgv: totalVgv,
        avgFrequency
      };
    }).sort((a, b) => b.numSales - a.numSales);
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
                    <div className="flex items-center justify-center gap-3 text-xs">
                      <div className="flex flex-col items-center" title="Vendas Angariadas">
                        <span className={`font-black ${row.vProps > 0 ? 'text-emerald-600' : 'text-muted-foreground/10'}`}>{row.vProps}</span>
                      </div>
                      <div className="w-[1px] h-4 bg-muted/20" />
                      <div className="flex flex-col items-center" title="Locações Angariadas">
                        <span className={`font-black ${row.rProps > 0 ? 'text-blue-600' : 'text-muted-foreground/10'}`}>{row.rProps}</span>
                      </div>
                    </div>
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
