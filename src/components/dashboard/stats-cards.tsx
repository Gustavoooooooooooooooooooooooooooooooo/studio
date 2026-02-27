import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Clock, DollarSign } from "lucide-react";

interface StatsCardsProps {
  totalSales: number;
  totalValue: number;
  avgTicket: number;
  avgDaysToSell: number;
}

export function StatsCards({ totalSales, totalValue, avgTicket, avgDaysToSell }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const stats = [
    {
      title: "Vendas Totais",
      value: totalSales,
      description: "Unidades vendidas no período",
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      title: "VGV Acumulado",
      value: formatCurrency(totalValue),
      description: "Valor Geral de Vendas",
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(avgTicket),
      description: "Valor médio por fechamento",
      icon: Users,
      color: "text-purple-600",
    },
    {
      title: "Tempo Médio",
      value: `${Math.round(avgDaysToSell)} dias`,
      description: "Entrada até o fechamento",
      icon: Clock,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/20">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}