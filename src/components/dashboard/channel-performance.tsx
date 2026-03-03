"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell } from "recharts";
import { useMemo } from "react";

interface ChannelPerformanceProps {
  leads: any[];
}

export function ChannelPerformance({ leads }: ChannelPerformanceProps) {
  const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    
    leads.forEach(lead => {
      // Busca especificamente pela coluna "Fonte" conforme solicitado
      const keys = Object.keys(lead);
      const sourceKey = keys.find(k => normalize(k) === "fonte" || normalize(k).includes("fonte"));
      
      // Fallback para "Origem" ou "Canal" caso "Fonte" não exista em algum registro
      const finalKey = sourceKey || keys.find(k => normalize(k).includes("origem") || normalize(k).includes("canal"));
      
      const channel = finalKey ? String(lead[finalKey]).trim() : "Outros";
      
      if (channel && channel !== "undefined" && channel !== "null" && channel !== "") {
        counts[channel] = (counts[channel] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Exibir top 10 canais
  }, [leads]);

  const config = {
    value: {
      label: "Leads",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card className="shadow-sm border-none bg-white">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Leads por Canal (Fonte)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="h-[300px] w-full">
            <ChartContainer config={config}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={110}
                    style={{ fontSize: '11px', fontWeight: '600' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                    {data.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            Sincronize a aba Leads para ver os dados.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
