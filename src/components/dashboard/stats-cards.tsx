
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Users, 
  Target, 
  Percent, 
  Clock, 
  Smile, 
  DollarSign,
  ArrowUpRight
} from "lucide-react";

interface StatsCardsProps {
  metrics: {
    avgDaysToSell: number;
    avgDaysToRent: number;
    totalValue: number;
    avgTicket: number;
    leadToVisitConv: number;
    visitToSaleConv: number;
    leadToSaleConv: number;
    avgCommission: number;
    avgDiscount: number;
    avgNps: number;
    cac: number;
  }
}

export function StatsCards({ metrics }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const kpis = [
    {
      title: "Ticket Médio",
      value: formatCurrency(metrics.avgTicket),
      description: "Valor médio de fechamento",
      icon: DollarSign,
      color: "text-blue-600",
      group: "Financeiro"
    },
    {
      title: "Conversão Lead → Visita",
      value: `${metrics.leadToVisitConv.toFixed(1)}%`,
      description: "Eficiência de agendamento",
      icon: Users,
      color: "text-emerald-600",
      group: "Conversão"
    },
    {
      title: "Conversão Visita → Venda",
      value: `${metrics.visitToSaleConv.toFixed(1)}%`,
      description: "Eficiência de fechamento",
      icon: Target,
      color: "text-orange-600",
      group: "Conversão"
    },
    {
      title: "Média de Comissão",
      value: `${metrics.avgCommission.toFixed(1)}%`,
      description: "Remuneração média",
      icon: Percent,
      color: "text-indigo-600",
      group: "Financeiro"
    },
    {
      title: "Tempo Médio Venda",
      value: `${Math.round(metrics.avgDaysToSell)} dias`,
      description: "Desde entrada no estoque",
      icon: Clock,
      color: "text-rose-600",
      group: "Geral"
    },
    {
      title: "NPS / Satisfação",
      value: metrics.avgNps.toFixed(1),
      description: "Média de satisfação",
      icon: Smile,
      color: "text-purple-600",
      group: "Geral"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi, index) => (
        <Card key={index} className="border-none shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.group}</p>
              <CardTitle className="text-sm font-semibold">{kpi.title}</CardTitle>
            </div>
            <div className={`p-2 rounded-full bg-muted/50 ${kpi.color}`}>
              <kpi.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.value}</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> {kpi.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
