"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell } from "recharts";
import { SaleRecord } from "@/app/lib/mock-data";

interface ChannelPerformanceProps {
  sales: SaleRecord[];
}

export function ChannelPerformance({ sales }: ChannelPerformanceProps) {
  const channelStats = sales.reduce((acc, sale) => {
    acc[sale.origem] = (acc[sale.origem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(channelStats)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const config = {
    value: {
      label: "Vendas",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card className="shadow-sm border-none">
      <CardHeader>
        <CardTitle className="text-lg font-semibold font-headline">Vendas por Canal</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: -20, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                width={100}
                style={{ fontSize: '12px' }}
              />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.6)"} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}