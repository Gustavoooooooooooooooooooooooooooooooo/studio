
"use client"

import { useState, useMemo, useEffect, useCallback } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
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
import { useFirebase, initiateAnonymousSignIn } from "@/firebase";

// Motor de tratamento de datas especializado (Versão Performática)
const formatDateDisplay = (val: any) => {
  if (!val || val === "N/A" || String(val).trim() === "") return "N/A";
  const strVal = String(val).trim();
  if (!/\d/.test(strVal)) return "N/A";

  if (strVal.match(/^\d{1,2}\.\d{1,2}\.\d{2,4}$/)) {
    return strVal.replace(/\./g, '/');
  }

  const cleanStr = strVal.replace(/[^\d]/g, '');
  const num = Number(cleanStr);
  if (!isNaN(num) && num > 40000 && num < 60000 && !strVal.includes('/') && !strVal.includes('.') && !strVal.includes('-')) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    return `${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${date.getUTCFullYear()}`;
  }
  return strVal;
};

// Conversor para Date para cálculos
const toDate = (val: any): Date | null => {
  const formatted = formatDateDisplay(val);
  if (formatted === "N/A") return null;
  const parts = formatted.split('/');
  if (parts.length === 3) {
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function AppContainer() {
  const [mounted, setMounted] = useState(false);
  const [now] = useState<Date>(new Date(2026, 2, 2)); 
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("2026");

  // Estados para Base Viva (Dados diretos da planilha)
  const [leads, setLeads] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  const { auth } = useFirebase();

  useEffect(() => {
    setMounted(true);
    if (auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [auth]);

  const metrics = useMemo(() => {
    const filteredSales = sales.filter(item => {
      const d = toDate(item.saleDate);
      if (!d) return false;
      const monthMatch = selectedMonth === "all" || d.getMonth() === parseInt(selectedMonth);
      const yearMatch = selectedYear === "all" || d.getFullYear() === parseInt(selectedYear);
      return monthMatch && yearMatch;
    });

    const filteredProperties = inventory.filter(item => {
      const d = toDate(item.captureDate);
      if (!d) return false;
      const monthMatch = selectedMonth === "all" || d.getMonth() === parseInt(selectedMonth);
      const yearMatch = selectedYear === "all" || d.getFullYear() === parseInt(selectedYear);
      return monthMatch && yearMatch;
    });

    const totalDaysSinceStart = 427; 
    const salesFrequency = sales.length > 0 ? totalDaysSinceStart / sales.length : 0;

    const validCycles = sales.map(s => {
      const start = toDate(s.propertyCaptureDate);
      const end = toDate(s.saleDate);
      if (start && end) return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return null;
    }).filter((d): d is number => d !== null && d >= 0);
    
    const avgDaysToSell = validCycles.length > 0 ? validCycles.reduce((a, b) => a + b, 0) / validCycles.length : 0;

    const totalVgvInventoryFiltered = filteredProperties.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0);
    const saleProps = filteredProperties.filter(p => (Number(p.saleValue) || 0) > 0);
    const avgTicket = saleProps.length > 0 ? totalVgvInventoryFiltered / saleProps.length : 0;

    const rentProps = filteredProperties.filter(p => (Number(p.rentalValue) || 0) > 0);
    const avgTicketRent = rentProps.length > 0 ? rentProps.reduce((acc, p) => acc + (Number(p.rentalValue) || 0), 0) / rentProps.length : 0;

    const allSaleDates = sales
      .map(s => toDate(s.saleDate))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    const lastSaleDate = allSaleDates[0];
    const daysSinceLastSale = lastSaleDate ? Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    return {
      avgDaysToSell,
      avgDaysToRent: 0,
      totalValue: totalVgvInventoryFiltered, 
      lastSaleDisplay: daysSinceLastSale !== null ? `${Math.max(0, daysSinceLastSale)} Dias` : "-",
      totalLeads: leads.length,
      totalSales: filteredSales.length,
      totalProperties: filteredProperties.length,
      avgTicket,
      avgTicketRent,
      salesFrequency
    };
  }, [sales, leads, inventory, now, selectedMonth, selectedYear]);

  if (!mounted) return null;

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
            <InventoryHealth properties={inventory} />
            <div className="space-y-6">
              <MonthlyTrends sales={sales} leads={leads} properties={inventory} />
              <BrokerPerformanceGrid 
                sales={sales} 
                leads={leads} 
                properties={inventory} 
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
              <ChannelPerformance leads={leads} />
            </div>
          </TabsContent>

          <TabsContent value="base" className="space-y-8"><SalesMatrix sales={sales} /></TabsContent>
          <TabsContent value="cadastro" className="space-y-6"><GoogleSheetsSync mode="inventory" onDataLoaded={setInventory} /><ImportedDataTable data={inventory} /></TabsContent>
          <TabsContent value="leads" className="space-y-6"><GoogleSheetsSync mode="leads" onDataLoaded={setLeads} /><LeadsDataTable data={leads} /></TabsContent>
          <TabsContent value="conclusao" className="space-y-6"><GoogleSheetsSync mode="sales" onDataLoaded={setSales} /><SalesDataTable data={sales} /></TabsContent>
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
