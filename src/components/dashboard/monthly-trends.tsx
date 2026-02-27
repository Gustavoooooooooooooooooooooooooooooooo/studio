"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { SaleRecord, LeadRecord, VisitRecord } from "@/app/lib/mock-data";

interface MonthlyTrendsProps {
  sales: SaleRecord[];
  leads: LeadRecord[];
  visits: VisitRecord[];
}

export function MonthlyTrends({ sales, leads, visits }: MonthlyTrendsProps) {
  const data = useMemo(() => {
    const monthlyData: Record<string, any> = {};
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // Inicializar meses de 2024
    monthsNames.forEach((name, i) => {
      const key = `2024-${String(i+1).padStart(2, '0')}`;
      monthlyData[key] = { 
        month: name,
        vendas: 0, 
        locacoes: 0,
        angariados: 0, 
        leads: 0,
        visitasVenda: 0,
        visitasLocacao: 0
      };
    });

    sales.forEach(sale => {
      const date = new Date(sale.data_venda);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        if (sale.tipo === 'Venda') monthlyData[key].vendas += 1;
        else monthlyData[key].locacoes += 1;
      }
      
      const entryDate = new Date(sale.data_entrada);
      const entryKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[entryKey]) monthlyData[entryKey].angariados += 1;
    });

    leads.forEach(lead => {
      const date = new Date(lead.data);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) monthlyData[key].leads += 1;
    });

    visits.forEach(visit => {
      const date = new Date(visit.data);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        if (visit.tipo === 'Venda') monthlyData[key].visitasVenda += 1;
        else monthlyData[key].visitasLocacao += 1;
      }
    });

    return Object.values(monthlyData);
  }, [sales, leads, visits]);

  const config = {
    vendas: { label: "Vendas", color: "hsl(var(--primary))" },
    locacoes: { label: "Locações", color: "hsl(var(--accent))" },
    leads: { label: "Leads", color: "#94a3b8" },
    visitasVenda: { label: "Visitas Venda", color: "#fbbf24" },
    visitasLocacao: { label: "Visitas Locação", color: "#f472b6" },
  };

  return (
    <Card className="shadow-sm border-none overflow-hidden">
      <CardHeader className="bg-muted/10 border-b">
        <CardTitle className="text-lg font-semibold">Análise Mensal (Fluxo de Funil)</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={config} className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend verticalAlign="top" height={45}/>
              <Line type="monotone" dataKey="vendas" stroke="var(--color-vendas)" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="locacoes" stroke="var(--color-locacoes)" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="leads" stroke="var(--color-leads)" strokeWidth={2} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="visitasVenda" stroke="var(--color-visitasVenda)" strokeWidth={1} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="visitasLocacao" stroke="var(--color-visitasLocacao)" strokeWidth={1} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
