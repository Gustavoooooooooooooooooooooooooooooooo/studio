
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Clock, DollarSign, CalendarCheck } from "lucide-react";

interface StatsCardsProps {
  totalSales: number;
  totalValue: number;
  avgTicket: number;
  avgDaysToSell: number;
  lastSaleDate: string | null;
}

export function StatsCards({ totalSales, totalValue, avgTicket, avgDaysToSell, lastSaleDate }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const stats = [
    {
      title: "VGV Acumulado",
      value: formatCurrency(totalValue),
      description: "Valor Geral de Vendas no período",
      icon: DollarSign,
      color: "text-emerald-600",
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(avgTicket),
      description: "Valor médio por venda",
      icon: Users,
      color: "text-indigo-600",
    },
    {
      title: "Giro de Carteira",
      value: `${Math.round(avgDaysToSell)} dias`,
      description: "Média entrada até venda",
      icon: Clock,
      color: "text-orange-600",
    },
    {
      title: "Última Venda",
      value: lastSaleDate ? new Date(lastSaleDate).toLocaleDateString('pt-BR') : "N/A",
      description: "Data do último fechamento",
      icon: CalendarCheck,
      color: "text-rose-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className="border-none shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/20 border-b">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.title}</CardTitle>
            <div className={`p-1.5 rounded-lg bg-white shadow-sm ${stat.color}`}>
               <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
