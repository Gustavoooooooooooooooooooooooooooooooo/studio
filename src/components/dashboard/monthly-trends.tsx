
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { SaleRecord } from "@/app/lib/mock-data";

interface MonthlyTrendsProps {
  sales: SaleRecord[];
}

export function MonthlyTrends({ sales }: MonthlyTrendsProps) {
  // Aggregate mock data for visualization
  // In a real app, this would query separate collections for listings vs leads vs visits
  const monthlyData = sales.reduce((acc, sale) => {
    const month = new Date(sale.data_venda).toLocaleDateString('pt-BR', { month: 'short' });
    if (!acc[month]) {
      acc[month] = { month, vendas: 0, angariados: Math.floor(Math.random() * 10) + 5, leads: Math.floor(Math.random() * 30) + 20 };
    }
    acc[month].vendas += 1;
    return acc;
  }, {} as Record<string, any>);

  const data = Object.values(monthlyData).reverse();

  const config = {
    vendas: { label: "Vendas", color: "hsl(var(--primary))" },
    angariados: { label: "Angariados", color: "hsl(var(--accent))" },
    leads: { label: "Leads", color: "#94a3b8" },
  };

  return (
    <Card className="shadow-sm border-none overflow-hidden">
      <CardHeader className="bg-muted/10 border-b">
        <CardTitle className="text-lg font-semibold">Tendências Mensais (Fluxo)</CardTitle>
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
              <Line type="monotone" dataKey="vendas" stroke="var(--color-vendas)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="angariados" stroke="var(--color-angariados)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="leads" stroke="var(--color-leads)" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
