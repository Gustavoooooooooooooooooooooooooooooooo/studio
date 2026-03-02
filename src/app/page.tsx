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
import { LayoutDashboard, FilePlus, BadgeCheck, TrendingUp, Loader2, Table2, Users } from "lucide-react";
import { useMemoFirebase, useCollection, useFirebase, initiateAnonymousSignIn } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

export default function AppContainer() {
  const [mounted, setMounted] = useState(false);
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

  const normalizeKey = (s: string) => 
    String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const metrics = useMemo(() => {
    const sales = rawSales || [];
    const leads = rawLeads || [];
    const properties = rawProperties || [];

    const parseDate = (d: any) => {
      if (!d) return null;
      if (typeof d === 'string') {
        const parts = d.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
        const isoDate = new Date(d);
        if (!isNaN(isoDate.getTime())) return isoDate;
      }
      return null;
    };

    const diffDays = (d1: Date | null, d2: Date | null) => {
      if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    const salesOnly = sales.filter(s => {
      const type = normalizeKey(s.tipoVenda || "");
      return type.includes("venda") || type === ""; // Se vazio, assume venda para não perder métricas se a coluna estiver incompleta
    });
    
    const rentsOnly = sales.filter(s => {
      const type = normalizeKey(s.tipoVenda || "");
      return type.includes("locacao") || type.includes("aluguel");
    });

    const calcAvgDays = (data: any[]) => {
      const validDiffs = data.map(s => {
        const start = parseDate(s.propertyCaptureDate);
        const end = parseDate(s.saleDate);
        return diffDays(start, end);
      }).filter(d => d !== null && d > 0) as number[];
      
      return validDiffs.length > 0 ? validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length : 0;
    };

    // Frequência de Vendas: (Período total / Quantidade de Vendas)
    // Indica a cada quantos dias acontece uma venda na imobiliária.
    const sortedSalesDates = salesOnly
      .map(s => parseDate(s.saleDate))
      .filter(d => d !== null && !isNaN(d!.getTime()))
      .sort((a, b) => a!.getTime() - b!.getTime());

    let salesFrequency = 0;
    if (sortedSalesDates.length > 1) {
      const first = sortedSalesDates[0]!;
      const last = sortedSalesDates[sortedSalesDates.length - 1]!;
      const totalDays = Math.floor((last.getTime() - first.getTime()) / (1000 * 3600 * 24));
      if (totalDays > 0) {
        salesFrequency = totalDays / (sortedSalesDates.length - 1);
      }
    } else if (sortedSalesDates.length === 1) {
      // Se tiver apenas uma venda, comparamos com o dia de hoje
      const first = sortedSalesDates[0]!;
      const totalDays = Math.floor((new Date().getTime() - first.getTime()) / (1000 * 3600 * 24));
      salesFrequency = totalDays || 0;
    }

    const lastSale = sortedSalesDates.length > 0 ? sortedSalesDates[sortedSalesDates.length - 1] : null;

    const daysSinceLastSale = lastSale 
      ? Math.floor((new Date().getTime() - lastSale.getTime()) / (1000 * 3600 * 24))
      : null;

    const totalVgv = sales.reduce((acc, s) => acc + (Number(s.closedValue) || 0), 0);

    return {
      avgDaysToSell: calcAvgDays(salesOnly),
      avgDaysToRent: calcAvgDays(rentsOnly),
      totalValue: totalVgv,
      lastSaleDisplay: daysSinceLastSale !== null && daysSinceLastSale >= 0
        ? `${daysSinceLastSale} Dias`
        : "0 Dias",
      totalLeads: leads.length,
      totalSales: sales.length,
      totalProperties: properties.length,
      avgTicket: sales.length > 0 ? totalVgv / sales.length : 0,
      salesFrequency: salesFrequency
    };
  }, [rawSales, rawLeads, rawProperties]);

  if (!mounted || isSalesLoading || isLeadsLoading || isPropertiesLoading) {
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-4xl mx-auto h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg"><LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard</TabsTrigger>
            <TabsTrigger value="base" className="rounded-lg"><Table2 className="h-4 w-4 mr-2" /> Base</TabsTrigger>
            <TabsTrigger value="cadastro" className="rounded-lg"><FilePlus className="h-4 w-4 mr-2" /> Cadastro</TabsTrigger>
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
