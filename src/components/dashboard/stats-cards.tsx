
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  Target, 
  Home,
  CheckCircle2,
  ArrowUpRight
} from "lucide-react";

interface StatsCardsProps {
  metrics: {
    avgDaysToSell: number;
    avgDaysToRent: number;
    totalValue: number;
    lastSaleDate: string;
    totalLeads: number;
    totalSales: number;
    totalProperties: number;
    avgTicket: number;
  }
}

export function StatsCards({ metrics }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const kpis = [
    {
      title: "Ciclo Médio de Venda",
      value: `${Math.round(metrics.avgDaysToSell)} dias`,
      description: "Média real (Entrada → Venda)",
      icon: Clock,
      color: "text-blue-600",
      group: "Performance"
    },
    {
      title: "Ciclo Médio de Locação",
      value: `${Math.round(metrics.avgDaysToRent)} dias`,
      description: "Um imóvel é locado em média",
      icon: Calendar,
      color: "text-emerald-600",
      group: "Performance"
    },
    {
      title: "Última Venda Realizada",
      value: metrics.lastSaleDate,
      description: "Data do fechamento mais recente",
      icon: CheckCircle2,
      color: "text-orange-600",
      group: "Histórico"
    },
    {
      title: "VGV Acumulado",
      value: formatCurrency(metrics.totalValue),
      description: "Volume total transacionado",
      icon: TrendingUp,
      color: "text-indigo-600",
      group: "Financeiro"
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(metrics.avgTicket),
      description: "Média por fechamento",
      icon: Target,
      color: "text-rose-600",
      group: "Financeiro"
    },
    {
      title: "Total de Leads",
      value: metrics.totalLeads,
      description: "Leads capturados na base",
      icon: Home,
      color: "text-purple-600",
      group: "Geral"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi, index) => (
        <Card key={index} className="border-none shadow-sm hover:shadow-md transition-all duration-300 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.group}</p>
              <CardTitle className="text-sm font-semibold">{kpi.title}</CardTitle>
            </div>
            <div className={`p-2 rounded-full bg-muted/30 ${kpi.color}`}>
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
