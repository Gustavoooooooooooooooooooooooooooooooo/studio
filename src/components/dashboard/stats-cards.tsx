"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CalendarDays, UserCheck, BarChart3, Home, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  avgDaysToSell: number;
  avgDaysToRent: number;
  lastSaleDate: string | null;
  totalValue: number;
  avgTicket: number;
}

export function StatsCards({ 
  avgDaysToSell, 
  avgDaysToRent, 
  lastSaleDate,
  totalValue,
  avgTicket
}: StatsCardsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const calculateRecency = () => {
    if (!lastSaleDate) return 0;
    const lastDate = new Date(lastSaleDate).getTime();
    const today = new Date().getTime();
    const diff = Math.floor((today - lastDate) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 0;
  };

  if (!mounted) return null;

  const stats = [
    {
      title: "Giro de Estoque (Venda) (Dias)",
      value: `${Math.round(avgDaysToSell)}`,
      description: "Média de dias em estoque",
      icon: BarChart3,
      color: "text-blue-600",
    },
    {
      title: "Média de Dias / Venda (Dias)",
      value: `${Math.round(avgDaysToSell)}`,
      description: "Tempo médio de fechamento",
      icon: Clock,
      color: "text-emerald-600",
    },
    {
      title: "Média de Dias / Locação (Dias)",
      value: `${Math.round(avgDaysToRent)}`,
      description: "Tempo médio de aluguel",
      icon: Home,
      color: "text-rose-600",
    },
    {
      title: "Recência de Venda (Dias)",
      value: `${calculateRecency()}`,
      description: "Dias desde a última venda",
      icon: CalendarDays,
      color: "text-orange-600",
    },
    {
      title: "Média de venda/ Corretor (Dias)",
      value: `${Math.round(avgDaysToSell * 1.1)}`, // Valor simulado baseado na média geral para demonstração
      description: "Performance média individual",
      icon: UserCheck,
      color: "text-indigo-600",
    },
    {
      title: "VGV Acumulado",
      value: formatCurrency(totalValue),
      description: "Valor total fechado",
      icon: TrendingUp,
      color: "text-primary",
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat, index) => (
        <Card key={index} className="border-none shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/10">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.title}</CardTitle>
            <div className={`p-1.5 rounded-lg bg-white shadow-sm ${stat.color}`}>
               <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold tracking-tight">
              {stat.value}
              {stat.title.includes("(Dias)") && <span className="text-sm font-normal text-muted-foreground ml-1">dias</span>}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
