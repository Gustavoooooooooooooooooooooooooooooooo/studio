
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  Target, 
  Home,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  Key
} from "lucide-react";

interface StatsCardsProps {
  metrics: {
    avgDaysToSell: number;
    avgDaysToRent: number;
    totalValue: number;
    lastSaleDisplay: string;
    totalLeads: number;
    totalSales: number;
    totalProperties: number;
    avgTicket: number;
    avgTicketRent: number;
    salesFrequency: number;
  }
}

export function StatsCards({ metrics }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const kpis = [
    {
      title: "VGV Acumulado",
      value: formatCurrency(metrics.totalValue),
      description: "Volume total em estoque (Venda)",
      icon: TrendingUp,
      color: "text-indigo-600",
      group: "Financeiro"
    },
    {
      title: "Ticket Médio Venda",
      value: formatCurrency(metrics.avgTicket),
      description: "Média de valor no estoque",
      icon: Target,
      color: "text-rose-600",
      group: "Financeiro"
    },
    {
      title: "Ticket Médio Locação",
      value: formatCurrency(metrics.avgTicketRent),
      description: "Média de aluguel no estoque",
      icon: Key,
      color: "text-emerald-600",
      group: "Financeiro"
    },
    {
      title: "Frequência de Vendas",
      value: `${metrics.salesFrequency > 0 ? Math.floor(metrics.salesFrequency) : 0} Dias`,
      description: "Intervalo médio entre vendas",
      icon: Zap,
      color: "text-amber-600",
      group: "Performance"
    },
    {
      title: "Ciclo Médio de Venda",
      value: `${Math.round(metrics.avgDaysToSell)} Dias`,
      description: "Média (Captura → Venda)",
      icon: Clock,
      color: "text-blue-600",
      group: "Performance"
    },
    {
      title: "Última Venda Realizada",
      value: metrics.lastSaleDisplay,
      description: "Tempo desde o último fechamento",
      icon: CheckCircle2,
      color: "text-emerald-600",
      group: "Histórico"
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
