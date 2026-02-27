"use client"

import { useState, useMemo, useEffect } from "react";
import { MOCK_SALES_DATA, MOCK_LEADS_DATA, MOCK_VISITS_DATA, brokers } from "@/app/lib/mock-data";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { AIPerformanceSummary } from "@/components/dashboard/ai-performance-summary";
import { NeighborhoodAnalysis } from "@/components/dashboard/neighborhood-analysis";
import { MonthlyTrends } from "@/components/dashboard/monthly-trends";
import { SalesMatrix } from "@/components/dashboard/sales-matrix";
import { BrokerPerformanceGrid } from "@/components/dashboard/broker-performance-grid";
import { InventoryHealth } from "@/components/dashboard/inventory-health";
import { SaleForm } from "@/components/forms/sale-form";
import { GoogleSheetsSync } from "@/components/dashboard/google-sheets-sync";
import { ImportedDataTable } from "@/components/dashboard/imported-data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, FilePlus, BadgeCheck, TrendingUp, Loader2, Table2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, initiateAnonymousSignIn } from "@/firebase";

export default function AppContainer() {
  const [mounted, setMounted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedBroker, setSelectedBroker] = useState<string>("all");
  const [businessType, setBusinessType] = useState<string>("all");
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
      const matchType = businessType === "all" || sale.tipo === (businessType === "venda" ? "Venda" : "Aluguel");
      return matchBroker && matchMonth && matchType;
    });
  }, [selectedBroker, selectedMonth, businessType]);

  const metrics = useMemo(() => {
    const salesOnly = filteredSales.filter(s => s.tipo === 'Venda');
    const rentsOnly = filteredSales.filter(s => s.tipo === 'Aluguel');

    const totalValue = filteredSales.reduce((acc, sale) => acc + sale.valor_fechado, 0);
    const avgTicket = filteredSales.length > 0 ? totalValue / filteredSales.length : 0;

    const calcAvgDays = (data: typeof filteredSales) => {
      if (data.length === 0) return 0;
      const totalDays = data.reduce((acc, item) => {
        const start = new Date(item.data_entrada).getTime();
        const end = new Date(item.data_venda).getTime();
        return acc + (end - start) / 86400000;
      }, 0);
      return totalDays / data.length;
    };

    const avgCommission = filteredSales.length > 0 
      ? filteredSales.reduce((acc, s) => acc + s.comissao_percentual, 0) / filteredSales.length 
      : 0;

    const avgDiscount = filteredSales.length > 0
      ? filteredSales.reduce((acc, s) => acc + ((s.valor_anuncio - s.valor_fechado) / s.valor_anuncio), 0) / filteredSales.length * 100
      : 0;

    const avgNps = filteredSales.length > 0
      ? filteredSales.reduce((acc, s) => acc + s.satisfacao_nps, 0) / filteredSales.length
      : 0;

    const lastSaleDate = filteredSales.length > 0 
      ? new Date(Math.max(...filteredSales.map(s => new Date(s.data_venda).getTime())))
      : new Date();
    const recency = Math.floor((new Date().getTime() - lastSaleDate.getTime()) / 86400000);

    const contextLeads = MOCK_LEADS_DATA.length / 12;
    const contextVisits = MOCK_VISITS_DATA.length / 12;
    const leadToVisitConv = (contextVisits / contextLeads) * 100;
    const visitToSaleConv = (filteredSales.length / contextVisits) * 100;
    const leadToSaleConv = (filteredSales.length / contextLeads) * 100;

    return { 
      avgDaysToSell: calcAvgDays(salesOnly), 
      avgDaysToRent: calcAvgDays(rentsOnly), 
      totalValue, 
      avgTicket,
      leadToVisitConv,
      visitToSaleConv,
      leadToSaleConv,
      avgCommission,
      avgDiscount,
      avgNps,
      recency,
      cac: 450
    };
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

          <div className="flex items-center gap-2">
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                <SelectItem value="venda">Vendas</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-3xl mx-auto h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="base" className="rounded-lg">
              <Table2 className="h-4 w-4 mr-2" /> Base
            </TabsTrigger>
            <TabsTrigger value="cadastro" className="rounded-lg">
              <FilePlus className="h-4 w-4 mr-2" /> Cadastro
            </TabsTrigger>
            <TabsTrigger value="conclusao" className="rounded-lg">
              <BadgeCheck className="h-4 w-4 mr-2" /> Conclusão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in duration-500">
            <StatsCards metrics={metrics} />
            
            <InventoryHealth />

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MonthlyTrends 
                  sales={MOCK_SALES_DATA} 
                  leads={MOCK_LEADS_DATA} 
                  visits={MOCK_VISITS_DATA}
                />
                <BrokerPerformanceGrid 
                  sales={filteredSales}
                  leads={MOCK_LEADS_DATA}
                  visits={MOCK_VISITS_DATA}
                />
              </div>
              <div className="space-y-6">
                <AIPerformanceSummary sales={filteredSales} />
                <ChannelPerformance sales={filteredSales} />
                <NeighborhoodAnalysis sales={filteredSales} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="base" className="space-y-8 animate-in fade-in duration-500">
            <SalesMatrix sales={filteredSales} />
          </TabsContent>

          <TabsContent value="cadastro" className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-4xl mx-auto space-y-6">
              <GoogleSheetsSync />
              <ImportedDataTable />
            </div>
          </TabsContent>

          <TabsContent value="conclusao" className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl mx-auto">
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
