
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

    // BASE DE CÁLCULO FIXA: 427 dias (01/01/2025 até 02/03/2026)
    const totalDaysCount = 427;

    return officialBrokers.map(brokerDoc => {
      const displayName = brokerDoc.name;
      const normName = normalize(displayName);

      // 1. Angariações (Busca na aba Cadastro - properties)
      const bProps = properties.filter(p => {
        const fields = [p.brokerId, p.angariador, p.captador, p.quemAngariou, p.responsavel];
        return fields.some(f => {
          const nv = normalize(String(f || ""));
          return nv === normName || (normName.length > 2 && nv.includes(normName));
        });
      });
      
      const vPropsCount = bProps.filter(p => {
          const val = Number(p.saleValue || p.valorVenda || 0);
          return val > 0;
      }).length;
      
      const lPropsCount = bProps.filter(p => {
          const val = Number(p.rentalValue || p.valorLocacao || 0);
          return val > 0;
      }).length;

      // 2. Leads & Visitas (Busca na aba Leads)
      const brokerLeads = leads.filter(l => {
        const entries = Object.entries(l);
        return entries.some(([key, val]) => {
          const nk = normalize(key);
          const nv = normalize(String(val || ""));
          
          if (nk.includes("corretor") || nk.includes("responsavel") || nk.includes("atendente") || nk.includes("vendedor") || nk === "atendido" || nk === "quem") {
             return nv === normName || (normName.length > 2 && nv.includes(normName));
          }
          return nv === normName;
        });
      });

      let visitsVenda = 0;
      let visitsLocacao = 0;

      brokerLeads.forEach(l => {
        const entries = Object.entries(l);
        // Verifica se Status da atividade atual é Realizada
        const hasVisit = entries.some(([key, val]) => {
          const nk = normalize(key);
          const nv = normalize(String(val || ""));
          return nk.includes("status da atividade atual") && nv.includes("realizada");
        });

        if (hasVisit) {
          // Determina se é Venda ou Locação
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

      // 3. VENDAS (Aba Conclusão - vendas_imoveis)
      const brokerSales = sales.filter(s => {
        const sellerFields = [s.vendedor, s.vendas, s.corretor, s.venda, s.responsavel, s.vendas_corretor];
        return sellerFields.some(f => {
          const nv = normalize(String(f || ""));
          return nv === normName || (normName.length > 2 && nv.includes(normName));
        });
      });
      
      const numSales = brokerSales.length;
      const totalVgv = brokerSales.reduce((acc, s) => acc + (Number(s.closedValue || s.valorVenda) || 0), 0);
      
      // 4. CÁLCULO DA FREQUÊNCIA: 427 / Vendas (Floor)
      const avgFrequency = numSales > 0 ? Math.floor(totalDaysCount / numSales) : 0;

      // 5. CONVERSÕES
      const totalVisits = visitsVenda + visitsLocacao;
      const leadConversionToVisit = brokerLeads.length > 0 ? (totalVisits / brokerLeads.length) * 100 : 0;
      const leadsPerVisit = totalVisits > 0 ? (brokerLeads.length / totalVisits) : 0;
      const leadsPerSale = numSales > 0 ? (brokerLeads.length / numSales) : 0;

      return {
        name: displayName,
        leads: brokerLeads.length,
        vProps: vPropsCount,
        lProps: lPropsCount,
        visitsVenda,
        visitsLocacao,
        conversionVisits: leadConversionToVisit,
        leadsPerVisit,
        numSales,
        leadsPerSale,
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
                <TableHead className="text-center border-r text-xs uppercase">Leads Atendidos</TableHead>
                <TableHead className="text-center border-r text-xs uppercase">Angariados</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-indigo-50/20">Visitas Venda</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-blue-50/20">Visitas Locação</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-emerald-50/20">Leads / Visita</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-primary/5">Vendas</TableHead>
                <TableHead className="text-center border-r text-xs uppercase bg-orange-50/10">Leads / Venda</TableHead>
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
                    <div className="flex flex-col items-center leading-tight">
                      <span title="Angariações de Venda" className={`font-black text-xs ${row.vProps > 0 ? 'text-emerald-600' : 'text-muted-foreground/10'}`}>
                        {row.vProps}
                      </span>
                      <div className="h-[1px] w-4 bg-muted/20 my-0.5" />
                      <span title="Angariações de Locação" className={`font-black text-xs ${row.lProps > 0 ? 'text-blue-600' : 'text-muted-foreground/10'}`}>
                        {row.lProps}
                      </span>
                    </div>
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
                    {row.leads > 0 && (row.visitsVenda + row.visitsLocacao) > 0 ? (
                      <div className="flex flex-col items-center justify-center h-full pt-1">
                        <span className="absolute top-1 left-1 text-[8px] font-bold text-emerald-600 opacity-60">
                          {row.conversionVisits.toFixed(1)}%
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
                          {((row.numSales / row.leads) * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] font-bold text-orange-700">
                          {row.leadsPerSale.toFixed(1)}
                        </span>
                      </div>
                    ) : "-"}
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
