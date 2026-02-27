"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { SaleRecord, neighborhoods } from "@/app/lib/mock-data";

interface NeighborhoodAnalysisProps {
  sales: SaleRecord[];
}

export function NeighborhoodAnalysis({ sales }: NeighborhoodAnalysisProps) {
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    neighborhoods.forEach(n => counts[n] = 0);
    
    sales.forEach(sale => {
      if (counts[sale.bairro] !== undefined) {
        counts[sale.bairro] += 1;
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [sales]);

  const COLORS = ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#3b82f6', '#6366f1', '#a855f7'];

  return (
    <Card className="shadow-sm border-none">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bairros Vendidos / Disponíveis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 space-y-2">
            <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Bairro mais vendido:</span>
                <span className="font-bold text-primary">{stats[0].name}</span>
            </div>
            <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Foco de angariação:</span>
                <span className="font-bold text-accent">{neighborhoods[Math.floor(Math.random() * neighborhoods.length)]}</span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
