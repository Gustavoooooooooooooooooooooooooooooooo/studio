
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
    // INTERVALO ABSOLUTO SOLICITADO: 427 dias desde 01/01/2025
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

    // Deduplicação RIGOROSA de Vendas (Apenas tipo "Venda" da aba de Conclusão)
    const uniqueSalesMap = new Map();
    sales.forEach(s => {
      const type = normalize(s.tipoVenda || s.tipo || "");
      // Filtramos APENAS o que é explicitamente Venda
      if (!type.includes('venda')) return;

      const pCode = String(s.propertyCode || "").trim();
      if (!pCode || pCode === "undefined" || pCode === "N/A") return;

      const cleanCode = normalize(pCode).replace(/[^a-z0-9]/g, "");
      const d = parseDate(s.saleDate);
      const cleanDate = d ? d.toISOString().split('T')[0] : normalize(s.saleDate);
      
      // Chave robusta para garantir contagem de vendas REAIS e ÚNICAS
      const key = `${cleanCode}-${cleanDate}-${Math.round(Number(s.closedValue))}`;
      if (!uniqueSalesMap.has(key)) {
        uniqueSalesMap.set(key, s);
      }
    });
    const dedupedSales = Array.from(uniqueSalesMap.values());

    return officialBrokers.map(brokerDoc => {
      const displayName = brokerDoc.name;
      const normName = normalize(displayName);

      // Métricas de Cadastro (Angariação) baseadas no brokerId
      const bProps = properties.filter(p => {
        const bId = normalize(p.brokerId);
        return bId === normName || bId.includes(normName);
      });
      const vProps = bProps.filter(p => Number(p.saleValue) > 0);
      const rProps = bProps.filter(p => Number(p.rentalValue) > 0);

      // Leads (Fevereiro/2026)
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

      const leadsMonthPast = brokerLeads.filter(l => {
        const keys = Object.keys(l);
        const dateKey = keys.find(k => {
          const nk = normalize(k);
          return nk.includes("data") || nk.includes("carimbo") || nk.includes("criado");
        });
        const date = dateKey ? parseDate(l[dateKey]) : null;
        return date && date.getMonth() === targetMonth && date.getFullYear() === targetYear;
      });

      // Vendas do corretor (exclusivamente Vendas únicas da aba Conclusão)
      const bSalesRecords = dedupedSales.filter(s => {
        const vend = normalize(s.vendedor || s.corretor);
        return vend === normName || vend.includes(normName);
      });
      
      const totalVgv = bSalesRecords.reduce((acc, s) => acc + (Number(s.closedValue) || 0), 0);
      const numSales = bSalesRecords.length;
      
      // FÓRMULA DE PRODUTIVIDADE REAL: 427 / Vendas (Usando Math.floor para bater com o cálculo manual)
      let avgFrequency = 0;
      if (numSales > 0) {
        avgFrequency = Math.floor(totalDaysCount / numSales);
      }

      return {
        name: displayName,
        leads: leadsMonthPast.length,
        vProps: vProps.length,
        rProps: rProps.length,
        numSales,
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
                      <div className="flex flex-col items-center">
                        <span className={`font-black ${row.vProps > 0 ? 'text-emerald-600' : 'text-muted-foreground/10'}`}>{row.vProps}</span>
                      </div>
                      <div className="w-[1px] h-4 bg-muted/20" />
                      <div className="flex flex-col items-center">
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
            <p className="text-xs">Vá na aba "Config" para cadastrar os corretores oficiais.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
