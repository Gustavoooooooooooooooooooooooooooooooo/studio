
"use client"

import { useState, useMemo, useEffect } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { AIPerformanceSummary } from "@/components/dashboard/ai-performance-summary";
import { NeighborhoodAnalysis } from "@/components/dashboard/neighborhood-analysis";
import { MonthlyTrends } from "@/components/dashboard/monthly-trends";
import { SalesMatrix } from "@/components/dashboard/sales-matrix";
import { BrokerPerformanceGrid } from "@/components/dashboard/broker-performance-grid";
import { InventoryHealth } from "@/components/dashboard/inventory-health";
import { GoogleSheetsSync } from "@/components/dashboard/google-sheets-sync";
import { ImportedDataTable } from "@/components/dashboard/imported-data-table";
import { SalesDataTable } from "@/components/dashboard/sales-data-table";
import { LeadsDataTable } from "@/components/dashboard/leads-data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, TrendingUp, Loader2, Table2, Users, BadgeCheck } from "lucide-react";
import { useMemoFirebase, useCollection, useFirebase, initiateAnonymousSignIn } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

export default function AppContainer() {
  const [mounted, setMounted] = useState(false);
  // Fixamos Hoje em 02 de Março de 2026 para os cálculos de performance.
  const [now] = useState<Date>(new Date(2026, 2, 2)); 
  const { auth, firestore } = useFirebase();

  useEffect(() => {
    setMounted(true);
    if (auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [auth]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "vendas_imoveis"), orderBy("importedAt", "desc"));
  }, [firestore]);

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "leads"), orderBy("importedAt", "desc"));
  }, [firestore]);

  const propertiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "properties"), orderBy("importedAt", "desc"));
  }, [firestore]);

  const { data: rawSales, isLoading: isSalesLoading } = useCollection(salesQuery);
  const { data: rawLeads, isLoading: isLeadsLoading } = useCollection(leadsQuery);
  const { data: rawProperties, isLoading: isPropertiesLoading } = useCollection(propertiesQuery);

  const metrics = useMemo(() => {
    const sales = rawSales || [];
    const leads = rawLeads || [];
    const properties = rawProperties || [];

    const parseDate = (d: any) => {
      if (!d) return null;
      if (d instanceof Date) return d;
      
      const cleanStr = String(d).trim();
      if (!cleanStr || cleanStr === "N/A" || cleanStr === "undefined" || cleanStr === "") return null;

      // Suporte para números seriais do Excel (Ex: 46037 para 15/01/2026)
      // Ajustado para lidar com formatos brasileiros de milhares (ponto) e decimais (vírgula)
      let val = cleanStr.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(val);
      
      if (!isNaN(num) && num > 40000 && num < 60000) {
        // Excel serial date to JS Date
        return new Date(Math.round((num - 25569) * 86400 * 1000));
      }

      // Suporte para DD/MM/AAAA
      const parts = cleanStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const yearPart = parts[2].trim();
        const year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10);
        const date = new Date(year, month, day);
        return isNaN(date.getTime()) ? null : date;
      }

      const date = new Date(cleanStr);
      return isNaN(date.getTime()) ? null : date;
    };

    const diffDays = (d1: Date, d2: Date) => {
      // Normalizamos para o início do dia para evitar problemas de fuso/horas
      const t1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
      const t2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
      return Math.floor((t1 - t2) / (1000 * 60 * 60 * 24));
    };

    // --- FILTRAGEM DE DATAS VÁLIDAS ---
    const validSalesDates = sales
      .map(s => parseDate(s.saleDate))
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

    // --- ÚLTIMA VENDA (Dias desde a última) ---
    const sortedDatesDesc = [...validSalesDates].sort((a, b) => b.getTime() - a.getTime());
    const lastSale = sortedDatesDesc.length > 0 ? sortedDatesDesc[0] : null;

    let daysSinceLastSaleDisplay = "0 Dias";
    if (lastSale && now) {
      const diff = diffDays(now, lastSale);
      daysSinceLastSaleDisplay = `${Math.max(0, diff)} Dias`;
    }

    // --- FREQUÊNCIA DE VENDAS (PASSO A PASSO LÓGICO SOLICITADO) ---
    // 1. Ordenação Cronológica (Mais antigo para mais novo)
    const sortedDatesAsc = [...validSalesDates].sort((a, b) => a.getTime() - b.getTime());
    
    let salesFrequency = 0;
    if (sortedDatesAsc.length > 1) {
      // 2. Cálculo dos Intervalos: Subtrair data da primeira da segunda, segunda da terceira...
      let sumIntervals = 0;
      let countIntervals = 0;

      for (let i = 0; i < sortedDatesAsc.length - 1; i++) {
        const interval = diffDays(sortedDatesAsc[i+1], sortedDatesAsc[i]);
        if (interval >= 0) {
          sumIntervals += interval;
          countIntervals++;
        }
      }
      
      // 3. Soma e Divisão: Dividir pela quantidade de intervalos (vendas - 1)
      if (countIntervals > 0) {
        salesFrequency = sumIntervals / countIntervals;
      }
    }

    // --- CICLO MÉDIO DE VENDA (Captura -> Venda) ---
    const validCycles = sales.map(s => {
      const start = parseDate(s.propertyCaptureDate);
      const end = parseDate(s.saleDate);
      if (start && end) return diffDays(end, start);
      return null;
    }).filter((d): d is number => d !== null && d >= 0);
    
    const avgDaysToSell = validCycles.length > 0 ? validCycles.reduce((a, b) => a + b, 0) / validCycles.length : 0;

    const totalVgv = sales.reduce((acc, s) => acc + (Number(s.closedValue) || 0), 0);

    return {
      avgDaysToSell,
      avgDaysToRent: 0,
      totalValue: totalVgv,
      lastSaleDisplay: daysSinceLastSaleDisplay,
      totalLeads: leads.length,
      totalSales: sales.length,
      totalProperties: properties.length,
      avgTicket: sales.length > 0 ? totalVgv / sales.length : 0,
      salesFrequency
    };
  }, [rawSales, rawLeads, rawProperties, now]);

  if (!mounted || isSalesLoading || isLeadsLoading || isPropertiesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-4xl mx-auto h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg"><LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard</TabsTrigger>
            <TabsTrigger value="base" className="rounded-lg"><Table2 className="h-4 w-4 mr-2" /> Base</TabsTrigger>
            <TabsTrigger value="cadastro" className="rounded-lg"><Table2 className="h-4 w-4 mr-2" /> Cadastro</TabsTrigger>
            <TabsTrigger value="leads" className="rounded-lg"><Users className="h-4 w-4 mr-2" /> Leads</TabsTrigger>
            <TabsTrigger value="conclusao" className="rounded-lg"><BadgeCheck className="h-4 w-4 mr-2" /> Conclusão</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in duration-500">
            <StatsCards metrics={metrics} />
            <InventoryHealth />
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MonthlyTrends sales={rawSales || []} leads={rawLeads || []} properties={rawProperties || []} />
                <BrokerPerformanceGrid sales={rawSales || []} leads={rawLeads || []} properties={rawProperties || []} />
              </div>
              <div className="space-y-6">
                <AIPerformanceSummary sales={rawSales || []} />
                <ChannelPerformance leads={rawLeads || []} />
                <NeighborhoodAnalysis sales={rawSales || []} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="base" className="space-y-8"><SalesMatrix sales={rawSales || []} /></TabsContent>
          <TabsContent value="cadastro" className="space-y-6"><GoogleSheetsSync mode="inventory" /><ImportedDataTable /></TabsContent>
          <TabsContent value="leads" className="space-y-6"><GoogleSheetsSync mode="leads" /><LeadsDataTable /></TabsContent>
          <TabsContent value="conclusao" className="space-y-6"><GoogleSheetsSync mode="sales" /><SalesDataTable /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-12 py-8 border-t bg-white">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ImmoSales Insight. Inteligência Real em Gestão Imobiliária.
        </div>
      </footer>
    </div>
  );
}
