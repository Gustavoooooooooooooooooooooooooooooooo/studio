"use client"

import { useState, useMemo } from "react";
import { MOCK_SALES_DATA, brokers, origins } from "@/app/lib/mock-data";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { AIPerformanceSummary } from "@/components/dashboard/ai-performance-summary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutDashboard, FileText, Filter, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedBroker, setSelectedBroker] = useState<string>("all");

  const months = useMemo(() => {
    const monthsSet = new Set<string>();
    MOCK_SALES_DATA.forEach(sale => {
      const date = new Date(sale.data_venda);
      monthsSet.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(monthsSet).sort().reverse();
  }, []);

  const filteredSales = useMemo(() => {
    return MOCK_SALES_DATA.filter(sale => {
      const matchBroker = selectedBroker === "all" || sale.corretor === selectedBroker;
      const saleDate = new Date(sale.data_venda);
      const saleMonth = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
      const matchMonth = selectedMonth === "all" || saleMonth === selectedMonth;
      return matchBroker && matchMonth;
    });
  }, [selectedBroker, selectedMonth]);

  const metrics = useMemo(() => {
    const totalSales = filteredSales.length;
    const totalValue = filteredSales.reduce((acc, sale) => acc + sale.valor_fechado, 0);
    const avgTicket = totalSales > 0 ? totalValue / totalSales : 0;
    const totalDays = filteredSales.reduce((acc, sale) => {
      const start = new Date(sale.data_entrada).getTime();
      const end = new Date(sale.data_venda).getTime();
      return acc + (end - start) / (1000 * 3600 * 24);
    }, 0);
    const avgDaysToSell = totalSales > 0 ? totalDays / totalSales : 0;

    return { totalSales, totalValue, avgTicket, avgDaysToSell };
  }, [filteredSales]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <LayoutDashboard className="text-white h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold font-headline tracking-tight text-primary">ImmoSales <span className="text-accent">Insight</span></h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 mr-4">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[180px] h-9 border-none shadow-none bg-muted/50">
                    <SelectValue placeholder="Selecionar Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Meses</SelectItem>
                    {months.map(m => (
                      <SelectItem key={m} value={m}>
                        {new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>

            <div className="hidden md:flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                  <SelectTrigger className="w-[180px] h-9 border-none shadow-none bg-muted/50">
                    <SelectValue placeholder="Corretor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Corretores</SelectItem>
                    {brokers.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          {/* Top Section: Metrics */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-headline">Visão Geral</h2>
              <p className="text-xs text-muted-foreground">Dados atualizados em tempo real</p>
            </div>
            <StatsCards {...metrics} />
          </section>

          {/* AI Insights Section */}
          <section>
            <AIPerformanceSummary sales={filteredSales} />
          </section>

          {/* Mid Section: Charts & Tables */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <PerformanceTable sales={filteredSales} />
              
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold font-headline">Últimas Vendas</h3>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-muted-foreground border-b uppercase text-[10px] tracking-wider">
                                <th className="pb-3 px-2">Data</th>
                                <th className="pb-3 px-2">ID</th>
                                <th className="pb-3 px-2">Cliente</th>
                                <th className="pb-3 px-2">Origem</th>
                                <th className="pb-3 px-2 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredSales.slice(0, 8).map((sale, i) => (
                                <tr key={i} className="hover:bg-muted/50 transition-colors">
                                    <td className="py-3 px-2 text-muted-foreground">
                                        {new Date(sale.data_venda).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-xs">{sale.id_imovel}</td>
                                    <td className="py-3 px-2 font-medium">{sale.cliente}</td>
                                    <td className="py-3 px-2">
                                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{sale.origem}</span>
                                    </td>
                                    <td className="py-3 px-2 text-right font-semibold">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(sale.valor_fechado)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <ChannelPerformance sales={filteredSales} />
              
              <div className="bg-primary text-white p-6 rounded-xl shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 transition-transform group-hover:scale-110">
                    <LayoutDashboard className="h-24 w-24" />
                </div>
                <h3 className="text-lg font-bold mb-2">Relatório Mensal</h3>
                <p className="text-sm text-primary-foreground/80 mb-6">Exporte todos os dados consolidados do período para análise externa.</p>
                <button className="w-full bg-white text-primary font-semibold py-2 rounded-lg hover:bg-accent hover:text-white transition-colors">
                    Exportar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ImmoSales Insight. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}