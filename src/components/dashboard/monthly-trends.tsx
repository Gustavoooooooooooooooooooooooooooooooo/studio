
"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface MonthlyTrendsProps {
  sales: any[];
  leads: any[];
  properties: any[];
}

export function MonthlyTrends({ sales, leads, properties }: MonthlyTrendsProps) {
  const data = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyData: Record<string, any> = {};
    
    // Inicializar 12 meses do ano atual real (2026)
    monthsNames.forEach((name, i) => {
      const key = `${currentYear}-${String(i+1).padStart(2, '0')}`;
      monthlyData[key] = { month: name, vendas: 0, locacoes: 0, leads: 0, angariados: 0 };
    });

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

    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    sales.forEach(sale => {
      const date = parseDate(sale.saleDate);
      if (date && date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          if (normalize(sale.tipoVenda).includes("venda")) monthlyData[key].vendas += 1;
          else monthlyData[key].locacoes += 1;
        }
      }
    });

    leads.forEach(lead => {
      const keys = Object.keys(lead);
      const dateKey = keys.find(k => normalize(k).includes("data") || normalize(k).includes("carimbo"));
      const date = dateKey ? parseDate(lead[dateKey]) : null;
      
      if (date && date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) monthlyData[key].leads += 1;
      }
    });

    properties.forEach(prop => {
      const date = parseDate(prop.captureDate);
      if (date && date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) monthlyData[key].angariados += 1;
      }
    });

    return Object.values(monthlyData);
  }, [sales, leads, properties]);

  const config = {
    vendas: { label: "Vendas", color: "hsl(var(--primary))" },
    locacoes: { label: "Locações", color: "hsl(var(--accent))" },
    leads: { label: "Leads", color: "#94a3b8" },
    angariados: { label: "Angariados", color: "#fbbf24" },
  };

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <CardHeader className="bg-muted/5 border-b">
        <CardTitle className="text-lg font-bold">Tendências Mensais ({new Date().getFullYear()})</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={config} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend verticalAlign="top" height={36}/>
              <Line type="monotone" dataKey="vendas" stroke="var(--color-vendas)" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="locacoes" stroke="var(--color-locacoes)" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="leads" stroke="var(--color-leads)" strokeWidth={2} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="angariados" stroke="var(--color-angariados)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
