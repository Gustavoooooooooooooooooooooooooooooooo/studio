
"use client"

import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BrokerPerformanceGridProps {
  sales: any[];
  leads: any[];
  visits: any[];
}

export function BrokerPerformanceGrid({ sales, leads, visits }: BrokerPerformanceGridProps) {
  const stats = useMemo(() => {
    // Identifica todos os corretores únicos presentes nos dados reais
    const uniqueBrokers = Array.from(new Set([
      ...sales.map(s => s.corretor),
      ...leads.map(l => l.corretor),
      ...visits.map(v => v.corretor)
    ])).filter(Boolean);

    return uniqueBrokers.map(broker => {
      const brokerSales = sales.filter(s => s.corretor === broker);
      const brokerLeads = leads.filter(l => l.corretor === broker);
      const brokerVisits = visits.filter(v => v.corretor === broker);
      
      const totalVgv = brokerSales.reduce((acc, s) => acc + (Number(s.valor_fechado) || 0), 0);
      const totalComm = brokerSales.reduce((acc, s) => acc + ((Number(s.valor_fechado) || 0) * ((Number(s.comissao_percentual) || 5.5) / 100)), 0);
      
      const visitToSale = brokerVisits.length > 0 ? (brokerSales.length / brokerVisits.length) * 100 : 0;
      const avgTicket = brokerSales.length > 0 ? totalVgv / brokerSales.length : 0;
      
      const participation = sales.length > 0 ? (brokerSales.length / sales.length) * 100 : 0;

      const avgTime = brokerSales.length > 0 
        ? brokerSales.reduce((acc, s) => {
            const start = new Date(s.data_entrada).getTime();
            const end = new Date(s.data_venda).getTime();
            if (isNaN(start) || isNaN(end)) return acc;
            return acc + (end - start);
          }, 0) / (brokerSales.length * 86400000)
        : 0;

      return {
        name: broker,
        leads: brokerLeads.length,
        visits: brokerVisits.length,
        sales: brokerSales.length,
        vgv: totalVgv,
        comm: totalComm,
        visitToSale,
        avgTicket,
        participation,
        avgTime
      };
    }).sort((a, b) => b.vgv - a.vgv);
  }, [sales, leads, visits]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  if (stats.length === 0) return null;

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10">
        <CardTitle className="text-lg font-bold">Matriz de Performance por Corretor</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/5">
              <TableHead className="font-bold">Corretor</TableHead>
              <TableHead className="text-center">Volume (L/V)</TableHead>
              <TableHead className="text-center">Participação</TableHead>
              <TableHead className="text-center">Conversão V/V</TableHead>
              <TableHead className="text-right">Ticket Médio</TableHead>
              <TableHead className="text-right">Tempo Médio</TableHead>
              <TableHead className="text-right">Comissão Acum.</TableHead>
              <TableHead className="text-right font-bold">VGV Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((row) => (
              <TableRow key={row.name} className="hover:bg-muted/5">
                <TableCell className="font-semibold">{row.name}</TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col text-[10px]">
                    <span className="text-blue-600 font-bold">{row.leads} Leads</span>
                    <span className="text-emerald-600 font-bold">{row.visits} Visitas</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-[10px]">{row.participation.toFixed(1)}%</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`font-bold text-xs ${row.visitToSale > 20 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {row.visitToSale.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right text-xs">{formatCurrency(row.avgTicket)}</TableCell>
                <TableCell className="text-right text-xs">{Math.round(row.avgTime)} dias</TableCell>
                <TableCell className="text-right text-xs text-emerald-600 font-medium">{formatCurrency(row.comm)}</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatCurrency(row.vgv)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
