
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
import { BrokerSettings } from "@/components/dashboard/broker-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutDashboard, TrendingUp, Loader2, Table2, Users, BadgeCheck, Settings, Calendar as CalendarIcon } from "lucide-react";
import { useMemoFirebase, useCollection, useFirebase, initiateAnonymousSignIn } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

export default function AppContainer() {
  const [mounted, setMounted] = useState(false);
  // Fixamos Hoje em 02 de Março de 2026 para os cálculos de performance.
  const [now] = useState<Date>(new Date(2026, 2, 2)); 
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("2026");

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
    const allSales = rawSales || [];
    const allLeads = rawLeads || [];
    const allProperties = rawProperties || [];

    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const parseDate = (d: any) => {
      if (!d) return null;
      if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
      const strVal = String(d).trim();
      if (!strVal || strVal === "N/A" || strVal === "undefined" || strVal === "") return null;

      // 1. Tentar DD/MM/YYYY ou DD-MM-YYYY
      const dmyMatch = strVal.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1;
        let year = parseInt(dmyMatch[3], 10);
        if (year < 100) year += 2000;
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }

      // 2. Tentar ISO YYYY-MM-DD
      const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const date = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
        if (!isNaN(date.getTime())) return date;
      }

      // 3. Tentar Serial do Excel (número puro)
      const cleanNumStr = strVal.replace(/[^\d]/g, '');
      const num = Number(cleanNumStr);
      if (!isNaN(num) && num > 40000 && num < 60000 && !strVal.includes('/') && !strVal.includes('-')) {
        return new Date(Math.round((num - 25569) * 86400 * 1000));
      }

      // 4. Fallback genérico
      const date = new Date(strVal);
      return isNaN(date.getTime()) ? null : date;
    };

    const diffDays = (d1: Date, d2: Date) => {
      const t1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
      const t2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
      return Math.floor((t1 - t2) / (1000 * 60 * 60 * 24));
    };

    // Dados Filtrados
    const filterData = (list: any[], dateField: string) => {
      return list.filter(item => {
        const d = parseDate(item[dateField]);
        if (!d) return false;
        const monthMatch = selectedMonth === "all" || d.getMonth() === parseInt(selectedMonth);
        const yearMatch = selectedYear === "all" || d.getFullYear() === parseInt(selectedYear);
        return monthMatch && yearMatch;
      });
    };

    const filteredSales = filterData(allSales, "saleDate");
    const filteredLeads = filterData(allLeads, "importedAt"); 
    const filteredProperties = filterData(allProperties, "captureDate");

    // LÓGICA DE FREQUÊNCIA E CICLO: SEMPRE TOTAL (2025-01-01 até Hoje)
    const uniqueSalesMapTotal = new Map();
    allSales.forEach(s => {
      const type = normalize(s.tipoVenda || s.tipo || "");
      const closedValue = Number(s.closedValue) || 0;
      // Aceita como venda se o tipo incluir "vend" OU se tiver um valor fechado significativo
      if (!type.includes('vend') && closedValue === 0) return;
      
      const cleanCode = normalize(s.propertyCode).replace(/[^a-z0-9]/g, "");
      const d = parseDate(s.saleDate);
      const cleanDate = d ? d.toISOString().split('T')[0] : normalize(s.saleDate);
      const key = `${cleanCode}-${cleanDate}-${Math.round(closedValue)}`;
      if (!uniqueSalesMapTotal.has(key)) uniqueSalesMapTotal.set(key, s);
    });
    const uniqueSalesListTotal = Array.from(uniqueSalesMapTotal.values());

    // Frequência Total (Base 427 dias)
    const totalDaysSinceStart = 427; 
    const salesFrequency = uniqueSalesListTotal.length > 0 ? totalDaysSinceStart / uniqueSalesListTotal.length : 0;

    // Ciclo Médio Total
    const validCyclesTotal = uniqueSalesListTotal.map(s => {
      const start = parseDate(s.propertyCaptureDate);
      const end = parseDate(s.saleDate);
      if (start && end) return diffDays(end, start);
      return null;
    }).filter((d): d is number => d !== null && d >= 0);
    const avgDaysToSell = validCyclesTotal.length > 0 ? validCyclesTotal.reduce((a, b) => a + b, 0) / validCyclesTotal.length : 0;

    // Métricas Filtradas para exibição
    const totalVgvInventoryFiltered = filteredProperties.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0);
    
    const saleProps = filteredProperties.filter(p => (Number(p.saleValue) || 0) > 0);
    const avgTicket = saleProps.length > 0 ? saleProps.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0) / saleProps.length : 0;

    const rentProps = filteredProperties.filter(p => (Number(p.rentalValue) || 0) > 0);
    const avgTicketRent = rentProps.length > 0 ? rentProps.reduce((acc, p) => acc + (Number(p.rentalValue) || 0), 0) / rentProps.length : 0;

    // Última Venda Realizada (Independente de Filtro de Mês para o card de Histórico)
    const sortedSalesDates = uniqueSalesListTotal
      .map(s => parseDate(s.saleDate))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    const lastSaleDate = sortedSalesDates[0];
    const daysSinceLastSale = lastSaleDate ? diffDays(now, lastSaleDate) : 0;

    return {
      avgDaysToSell,
      avgDaysToRent: 0,
      totalValue: totalVgvInventoryFiltered, 
      lastSaleDisplay: lastSaleDate ? `${Math.max(0, daysSinceLastSale)} Dias` : "-",
      totalLeads: filteredLeads.length,
      totalSales: filteredSales.length,
      totalProperties: filteredProperties.length,
      avgTicket,
      avgTicketRent,
      salesFrequency
    };
  }, [rawSales, rawLeads, rawProperties, now, selectedMonth, selectedYear]);

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
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px] h-8 border-none bg-transparent shadow-none focus:ring-0">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Meses</SelectItem>
                  <SelectItem value="0">Janeiro</SelectItem>
                  <SelectItem value="1">Fevereiro</SelectItem>
                  <SelectItem value="2">Março</SelectItem>
                  <SelectItem value="3">Abril</SelectItem>
                  <SelectItem value="4">Maio</SelectItem>
                  <SelectItem value="5">Junho</SelectItem>
                  <SelectItem value="6">Julho</SelectItem>
                  <SelectItem value="7">Agosto</SelectItem>
                  <SelectItem value="8">Setembro</SelectItem>
                  <SelectItem value="9">Outubro</SelectItem>
                  <SelectItem value="10">Novembro</SelectItem>
                  <SelectItem value="11">Dezembro</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="w-[1px] h-4 bg-muted-foreground/20 mx-1" />
              
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] h-8 border-none bg-transparent shadow-none focus:ring-0">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full max-w-5xl mx-auto h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg"><LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard</TabsTrigger>
            <TabsTrigger value="base" className="rounded-lg"><Table2 className="h-4 w-4 mr-2" /> Base</TabsTrigger>
            <TabsTrigger value="cadastro" className="rounded-lg"><Table2 className="h-4 w-4 mr-2" /> Cadastro</TabsTrigger>
            <TabsTrigger value="leads" className="rounded-lg"><Users className="h-4 w-4 mr-2" /> Leads</TabsTrigger>
            <TabsTrigger value="conclusao" className="rounded-lg"><BadgeCheck className="h-4 w-4 mr-2" /> Conclusão</TabsTrigger>
            <TabsTrigger value="config" className="rounded-lg"><Settings className="h-4 w-4 mr-2" /> Config</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in duration-500">
            <StatsCards metrics={metrics} />
            <InventoryHealth />
            <div className="space-y-6">
              <MonthlyTrends sales={rawSales || []} leads={rawLeads || []} properties={rawProperties || []} />
              <BrokerPerformanceGrid 
                sales={rawSales || []} 
                leads={rawLeads || []} 
                properties={rawProperties || []} 
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
              <ChannelPerformance leads={rawLeads || []} />
            </div>
          </TabsContent>

          <TabsContent value="base" className="space-y-8"><SalesMatrix sales={rawSales || []} /></TabsContent>
          <TabsContent value="cadastro" className="space-y-6"><GoogleSheetsSync mode="inventory" /><ImportedDataTable /></TabsContent>
          <TabsContent value="leads" className="space-y-6"><GoogleSheetsSync mode="leads" /><LeadsDataTable /></TabsContent>
          <TabsContent value="conclusao" className="space-y-6"><GoogleSheetsSync mode="sales" /><SalesDataTable /></TabsContent>
          <TabsContent value="config" className="space-y-6"><BrokerSettings /></TabsContent>
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
