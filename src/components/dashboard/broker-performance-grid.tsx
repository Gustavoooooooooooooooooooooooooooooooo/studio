
"use client"

import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BrokerPerformanceGridProps {
  sales: any[];
  leads: any[];
  properties: any[];
}

export function BrokerPerformanceGrid({ sales, leads, properties }: BrokerPerformanceGridProps) {
  const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const stats = useMemo(() => {
    // Mapa para unificar nomes: chave normalizada -> nome de exibição original
    const brokerMap = new Map<string, string>();
    
    const addBroker = (name: any) => {
      const sName = String(name || "");
      const norm = normalize(sName);
      if (norm && norm !== "undefined" && norm !== "n/a" && norm !== "null" && norm !== "") {
        // Se ainda não temos esse corretor no mapa, adicionamos o primeiro nome encontrado como padrão de exibição
        if (!brokerMap.has(norm)) {
          brokerMap.set(norm, sName);
        }
      }
    };

    // Coletar todos os nomes possíveis de todas as bases
    sales.forEach(s => {
      addBroker(s.vendedor);
      addBroker(s.angariador);
    });
    leads.forEach(l => {
      const keys = Object.keys(l);
      const key = keys.find(k => normalize(k).includes("corretor"));
      if (key) addBroker(l[key]);
    });
    properties.forEach(p => addBroker(p.brokerId));

    const uniqueNormalizedNames = Array.from(brokerMap.keys());

    return uniqueNormalizedNames.map(normName => {
      const displayName = brokerMap.get(normName) || "N/A";

      // Métricas de Vendas/Locações (Filtro por nome normalizado)
      const bSalesRecords = sales.filter(s => normalize(s.vendedor) === normName);
      const vSales = bSalesRecords.filter(s => normalize(s.tipoVenda).includes("venda"));
      const rSales = bSalesRecords.filter(s => normalize(s.tipoVenda).includes("locacao") || normalize(s.tipoVenda).includes("aluguel"));

      // Métricas de Cadastro (Angariação)
      const bProps = properties.filter(p => normalize(p.brokerId) === normName);
      const vProps = bProps.filter(p => Number(p.saleValue) > 0);
      const rProps = bProps.filter(p => Number(p.rentalValue) > 0);

      // Métricas de Leads
      const bLeads = leads.filter(l => {
        const keys = Object.keys(l);
        const key = keys.find(k => normalize(k).includes("corretor"));
        return key && normalize(l[key]) === normName;
      });

      const totalVgv = bSalesRecords.reduce((acc, s) => acc + (Number(s.closedValue) || 0), 0);
      
      const parseDate = (d: any) => {
        if (!d) return null;
        if (typeof d === 'string') {
          const parts = d.split('/');
          if (parts.length === 3) {
            const year = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2]);
            return new Date(year, Number(parts[1]) - 1, Number(parts[0]));
          }
          return new Date(d);
        }
        return null;
      };

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
  }, [sales, leads, properties]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-muted/10">
        <CardTitle className="text-lg font-bold">Performance Real por Corretor</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/5">
              <TableHead className="font-bold">Corretor</TableHead>
              <TableHead className="text-center">Leads</TableHead>
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
            {stats.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Aguardando sincronização de dados reais...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
