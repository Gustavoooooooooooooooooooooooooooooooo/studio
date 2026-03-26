

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Clock, 
  Target, 
  CheckCircle2,
  ArrowUpRight,
  Zap,
  Key,
  Percent,
  BadgeDollarSign,
  Handshake,
  Users,
  CalendarCheck
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
    avgDiscountSale: number;
    avgDiscountRent: number;
    avgDiscountValueSale: number;
    avgDiscountValueRent: number;
    avgCommissionSale: number;
    avgCommissionRent: number;
    totalDeals: number;
    avgLeadsVenda: number;
    avgLeadsLocacao: number;
    avgVisitsVenda: number;
    avgVisitsLocacao: number;
    totalVGVFechado: number;
    totalVGLFechado: number;
  }
}

export function StatsCards({ metrics }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const kpis = [
    {
      title: "VGV em Estoque",
      value: formatCurrency(metrics.totalValue),
      description: "Volume total em carteira (Venda)",
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
      color: "text-cyan-600",
      group: "Financeiro"
    },
    {
      title: "Última Venda Realizada",
      value: metrics.lastSaleDisplay,
      description: "Tempo desde o último fechamento",
      icon: CheckCircle2,
      color: "text-emerald-600",
      group: "Histórico"
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
      title: "Média de Desconto",
      icon: Percent,
      color: "text-orange-600",
      group: "Negociação",
      values: [
        { label: "Venda", percentage: `${metrics.avgDiscountSale.toFixed(1)}%`, value: formatCurrency(metrics.avgDiscountValueSale) },
        { label: "Locação", percentage: `${metrics.avgDiscountRent.toFixed(1)}%`, value: formatCurrency(metrics.avgDiscountValueRent) },
      ]
    },
    {
      title: "Comissão Média",
      icon: BadgeDollarSign,
      color: "text-green-600",
      group: "Financeiro",
      values: [
        { label: "Venda", value: formatCurrency(metrics.avgCommissionSale) },
        { label: "Locação", value: formatCurrency(metrics.avgCommissionRent) },
      ]
    },
    {
      title: "Negócios Fechados",
      value: String(metrics.totalDeals),
      description: "Vendas e locações no período",
      icon: Handshake,
      color: "text-purple-600",
      group: "Performance"
    },
    {
      title: "Valor Fechado (VGV/VGL)",
      icon: BadgeDollarSign,
      color: "text-green-600",
      group: "Financeiro",
      values: [
        { label: "Venda", value: formatCurrency(metrics.totalVGVFechado) },
        { label: "Locação", value: formatCurrency(metrics.totalVGLFechado) },
      ]
    },
    {
      title: "Média de Leads / Mês",
      icon: Users,
      color: "text-sky-600",
      group: "Aquisição",
      values: [
        { label: "Venda", value: String(Math.round(metrics.avgLeadsVenda)) },
        { label: "Locação", value: String(Math.round(metrics.avgLeadsLocacao)) },
      ]
    },
    {
      title: "Média de Visitas / Mês",
      icon: CalendarCheck,
      color: "text-teal-600",
      group: "Performance",
      values: [
        { label: "Venda", value: String(Math.round(metrics.avgVisitsVenda)) },
        { label: "Locação", value: String(Math.round(metrics.avgVisitsLocacao)) },
      ]
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi: any, index) => (
        'values' in kpi ? (
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
            <CardContent className="pt-2">
              <div className="grid grid-cols-2 gap-2">
                {kpi.values.map((v: any) => (
                  <div key={v.label} className="border-l first:border-l-0 pl-2 first:pl-0">
                    <p className="text-xs text-muted-foreground">{v.label}</p>
                    {v.percentage ? (
                      <>
                        <p className="text-lg font-bold">{v.percentage}</p>
                        <p className="text-xs text-muted-foreground">{v.value}</p>
                      </>
                    ) : (
                      <p className="text-lg font-bold">{v.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
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
        )
      ))}
    </div>
  );
}
