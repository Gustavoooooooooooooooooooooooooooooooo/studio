"use client"

import { useState, useMemo, useEffect } from "react";
import { MOCK_SALES_DATA, MOCK_LEADS_DATA, MOCK_VISITS_DATA, brokers } from "@/app/lib/mock-data";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { AIPerformanceSummary } from "@/components/dashboard/ai-performance-summary";
import { NeighborhoodAnalysis } from "@/components/dashboard/neighborhood-analysis";
import { MonthlyTrends } from "@/components/dashboard/monthly-trends";
import { SalesMatrix } from "@/components/dashboard/sales-matrix";
import { PropertyForm } from "@/components/forms/property-form";
import { SaleForm } from "@/components/forms/sale-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, FilePlus, BadgeCheck, Filter, Calendar, TrendingUp, Loader2, Table2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, initiateAnonymousSignIn } from "@/firebase";

export default function AppContainer() {
  const [mounted, setMounted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedBroker, setSelectedBroker] = useState<string>("all");
  const auth = useAuth();

  useEffect(() => {
    setMounted(true);
    if (auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [auth]);

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
    const salesOnly = filteredSales.filter(s => s.tipo === 'Venda');
    const rentsOnly = filteredSales.filter(s => s.tipo === 'Aluguel');

    const totalSales = salesOnly.length;
    const totalRents = rentsOnly.length;
    const totalValue = filteredSales.reduce((acc, sale) => acc + sale.valor_fechado, 0);
    const avgTicket = totalSales > 0 ? salesOnly.reduce((acc, s) => acc + s.valor_fechado, 0) / totalSales : 0;

    const calcAvgDays = (data: typeof filteredSales) => {
      if (data.length === 0) return 0;
      const totalDays = data.reduce((acc, item) => {
        const start = new Date(item.data_entrada).getTime();
        const end = new Date(item.data_venda).getTime();
        return acc + (end - start) / (1000 * 3600 * 24);
      }, 0);
      return totalDays / data.length;
    };

    const avgDaysToSell = calcAvgDays(salesOnly);
    const avgDaysToRent = calcAvgDays(rentsOnly);
    const lastSaleDate = filteredSales.length > 0 ? filteredSales[0].data_venda : null;

    return { totalSales, totalRents, totalValue, avgTicket, avgDaysToSell, avgDaysToRent, lastSaleDate };
  }, [filteredSales]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="text-white h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-primary">
              ImmoSales <span className="text-accent">Insight</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[160px] h-9 bg-muted/50 border-none">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Meses</SelectItem>
                    {months.map(m => (
                      <SelectItem key={m} value={m}>
                        {new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            <div className="hidden lg:flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                  <SelectTrigger className="w-[160px] h-9 bg-muted/50 border-none">
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

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-3xl mx-auto h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="base" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Table2 className="h-4 w-4 mr-2" />
              Base
            </TabsTrigger>
            <TabsTrigger value="cadastro" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FilePlus className="h-4 w-4 mr-2" />
              Cadastro
            </TabsTrigger>
            <TabsTrigger value="conclusao" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <BadgeCheck className="h-4 w-4 mr-2" />
              Conclusão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in duration-500">
            <StatsCards {...metrics} />
            
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MonthlyTrends 
                  sales={MOCK_SALES_DATA} 
                  leads={MOCK_LEADS_DATA} 
                  visits={MOCK_VISITS_DATA}
                />
              </div>
              <div className="space-y-6">
                <AIPerformanceSummary sales={filteredSales} />
                <ChannelPerformance sales={filteredSales} />
                <NeighborhoodAnalysis sales={filteredSales} />
                <PerformanceTable sales={filteredSales} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="base" className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Table2 className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold text-primary">Matriz de Performance</h2>
                  <p className="text-sm text-muted-foreground">Visão analítica consolidada em formato de planilha.</p>
                </div>
              </div>
              <SalesMatrix sales={filteredSales} />
            </div>
          </TabsContent>

          <TabsContent value="cadastro" className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-primary">Cadastro de Imóveis</h2>
                <p className="text-muted-foreground text-sm">Registre a captação de um novo imóvel na carteira.</p>
              </div>
              <PropertyForm />
            </div>
          </TabsContent>

          <TabsContent value="conclusao" className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-primary">Conclusão de Venda</h2>
                <p className="text-muted-foreground text-sm">Preencha os dados finais após o fechamento do negócio.</p>
              </div>
              <SaleForm />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-12 py-8 border-t bg-white">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ImmoSales Insight. Inteligência em Gestão Imobiliária.
        </div>
      </footer>
    </div>
  );
}
