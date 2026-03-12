
"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { MonthlyTrends } from "@/components/dashboard/monthly-trends";
import { SalesMatrix } from "@/components/dashboard/sales-matrix";
import { BrokerPerformanceGrid } from "@/components/dashboard/broker-performance-grid";
import { InventoryHealth } from "@/components/dashboard/inventory-health";
import { BrokerSettings } from "@/components/dashboard/broker-settings";
import { SheetUrlConfig } from "@/components/dashboard/sheet-url-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutDashboard, TrendingUp, Table2, Settings, Calendar as CalendarIcon, Loader2, AlertTriangle, RefreshCcw } from "lucide-react";
import { useFirebase, initiateAnonymousSignIn } from "@/firebase";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";


// Engine for specialized date handling (Performant Version)
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

// Converter for Date calculations
const toDate = (val: any): Date | null => {
  const formatted = formatDateDisplay(val);
  if (formatted === "N/A") return null;
  const parts = formatted.split('/');
  if (parts.length === 3) {
    const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
    return new Date(year, Number(parts[1]) - 1, Number(parts[0]));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Helper functions from the old google-sheets-sync component
const getVal = (row: any, searchKeys: string[], excludeKeys: string[] = []) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const normalizedSearch = searchKeys.map(normalize);
    const normalizedExclude = excludeKeys.map(normalize);

    for (const sKey of normalizedSearch) {
      const match = rowKeys.find(rk => {
        const nrk = normalize(rk);
        const isMatch = nrk === sKey || nrk.includes(sKey);
        const isExcluded = normalizedExclude.some(ex => nrk.includes(ex));
        return isMatch && !isExcluded;
      });
      if (match) {
        const val = row[match];
        if (sKey.includes("data") || sKey.includes("carimbo")) {
            if (val && !/\d/.test(String(val))) continue;
        }
        return val;
      }
    }
    return undefined;
  };

const parseCurrency = (val: any) => {
    if (val === undefined || val === null || String(val).trim() === "") return 0;
    if (typeof val === 'number') return val;
    let s = String(val).trim().replace(/[R$ ]/g, "");
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(',') && !s.includes('.')) s = s.replace(",", ".");
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
};


export default function AppContainer() {
  const [mounted, setMounted] = useState(false);
  const [now] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const [urls, setUrls] = useState({ inventory: "", leads: "", sales: "" });
  const [manualBrokers, setManualBrokers] = useState<string[]>([]);
  const [targets, setTargets] = useState<{
    [key: string]: {
      captures: { annual: number; quarterly: number; semiannual: number; };
      sales: { annual: number; quarterly: number; semiannual: number; };
      rentals: { annual: number; quarterly: number; semiannual: number; };
    }
  }>({
    global: {
      captures: { annual: 400, quarterly: 100, semiannual: 200 },
      sales: { annual: 120, quarterly: 30, semiannual: 60 },
      rentals: { annual: 150, quarterly: 40, semiannual: 75 },
    }
  });

  // Data states
  const [leads, setLeads] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  const { auth, user } = useFirebase();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (auth && !user) {
      initiateAnonymousSignIn(auth);
    }
    const savedUrls = {
      inventory: localStorage.getItem('sheet_url_inventory') || "",
      leads: localStorage.getItem('sheet_url_leads') || "",
      sales: localStorage.getItem('sheet_url_sales') || ""
    };
    setUrls(savedUrls);
    const savedManualBrokers = localStorage.getItem('manual_brokers');
    if (savedManualBrokers) {
      try {
        setManualBrokers(JSON.parse(savedManualBrokers));
      } catch (e) {
        console.error("Failed to parse manual brokers from localStorage", e);
      }
    }
    const savedTargets = localStorage.getItem('app_targets');
    if (savedTargets) {
      try {
        const parsed = JSON.parse(savedTargets);
        if (parsed.global && parsed.global.captures) { // Basic validation for new structure
          setTargets(parsed);
        }
      } catch (e) {
        console.error("Failed to parse targets from localStorage", e);
      }
    }
  }, [auth, user]);

  useEffect(() => {
    setMounted(true);
  },[])

  const handleUrlsChange = (newUrls: { inventory: string; leads: string; sales: string; }) => {
    setUrls(newUrls);
    localStorage.setItem('sheet_url_inventory', newUrls.inventory);
    localStorage.setItem('sheet_url_leads', newUrls.leads);
    localStorage.setItem('sheet_url_sales', newUrls.sales);
    // Trigger a sync after saving new URLs
    handleSync(false);
  };
  
  const handleAddBroker = useCallback((brokerName: string) => {
    const trimmedBrokerName = brokerName.trim();
    if (!trimmedBrokerName) return;

    setManualBrokers(prevBrokers => {
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const brokerExists = prevBrokers.some(b => normalize(b) === normalize(trimmedBrokerName));
  
      if (brokerExists) {
        // We can't call toast here directly because of React's render cycle rules.
        // Instead, we can schedule it.
        setTimeout(() => toast({ variant: "destructive", title: "Corretor já existe", description: `"${trimmedBrokerName}" já está na sua lista.` }), 0);
        return prevBrokers;
      }
      
      const updatedBrokers = [...prevBrokers, trimmedBrokerName];
      localStorage.setItem('manual_brokers', JSON.stringify(updatedBrokers));
      setTimeout(() => toast({ title: "Corretor Adicionado", description: `"${trimmedBrokerName}" foi adicionado à lista.` }), 0);
      return updatedBrokers;
    });
  }, [toast]);
  
  const handleDeleteBroker = useCallback((brokerNameToDelete: string) => {
    setManualBrokers(prevBrokers => {
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const updatedBrokers = prevBrokers.filter(b => normalize(b) !== normalize(brokerNameToDelete));
      
      localStorage.setItem('manual_brokers', JSON.stringify(updatedBrokers));
      setTimeout(() => toast({ title: "Corretor Removido", description: `"${brokerNameToDelete}" foi removido da lista.` }), 0);
      return updatedBrokers;
    });
  }, [toast]);

  const handleTargetsChange = useCallback((newTargets: typeof targets) => {
    setTargets(newTargets);
    localStorage.setItem('app_targets', JSON.stringify(newTargets));
    toast({ title: "Metas Atualizadas", description: "As novas metas de performance foram salvas." });
  }, [toast]);
  
  // The definitive list of brokers is the one managed manually.
  const allBrokers = useMemo(() => {
    return [...manualBrokers].sort();
  }, [manualBrokers]);


  const handleSync = useCallback(async (silent = false) => {
    if (syncingRef.current || !auth || !user) return;
    
    syncingRef.current = true;
    setSyncing(true);

    const processSheet = async (url: string, mode: 'inventory' | 'sales' | 'leads') => {
      if (!url) return { success: false, data: [] };
      try {
        const result = await syncGoogleSheets({ sheetUrl: url });
        if (!result.success || !result.data) {
          throw new Error(result.message || "Falha ao ler planilha");
        }

        const processedData = result.data.map((row, idx) => {
          if (mode === 'inventory') {
            const propertyCode = getVal(row, ["codigo", "unidade", "referencia", "id_imovel"]) || `REF-${idx + 1}`;
            return {
              id: propertyCode,
              propertyCode,
              neighborhood: String(getVal(row, ["bairro", "localizacao"]) || "N/A"),
              saleValue: parseCurrency(getVal(row, ["valor venda", "venda"])),
              rentalValue: parseCurrency(getVal(row, ["valor locacao", "aluguel", "locacao", "valor aluguel"])),
              brokerId: String(getVal(row, ["angariador", "corretor", "captador"]) || "N/A"),
              captureDate: formatDateDisplay(getVal(row, ["data entrada", "entrada", "cadastro", "carimbo"])),
              status: String(getVal(row, ["status", "situacao"]) || "Disponível"),
            };
          } else if (mode === 'sales') {
            const propertyCode = getVal(row, ["codigo", "unidade", "referencia", "id_imovel"]) || `REF-${idx + 1}`;
            return {
              id: `${propertyCode}-${idx}`,
              vendedor: String(getVal(row, ["vendedor", "corretor", "responsavel"]) || "N/A"),
              angariador: String(getVal(row, ["angariador", "captador"]) || "N/A"),
              propertyCode,
              neighborhood: String(getVal(row, ["bairro", "localizacao"]) || "N/A"),
              clientName: String(getVal(row, ["cliente", "comprador"]) || "N/A"),
              advertisedValue: parseCurrency(getVal(row, ["valor anuncio", "anuncio"])),
              closedValue: parseCurrency(getVal(row, ["valor fechado", "valor venda"])),
              saleDate: formatDateDisplay(getVal(row, ["data do venda", "data venda", "fechamento", "venda"], ["vendedor", "corretor"])),
              propertyCaptureDate: formatDateDisplay(getVal(row, ["data entrada", "entrada", "cadastro", "carimbo"])),
              tipo: String(getVal(row, ["tipo", "natureza", "negocio"]) || "Venda"),
              status: "Vendido",
            };
          } else { // leads
            const rowValues = Object.values(row).map((v) => String(v || "").trim()).join("|");
            const leadIdSeed = rowValues.substring(0, 100).replace(/[\/\.\#\$\/\[\] ]/g, "-");
            return {
              id: `lead-${leadIdSeed}-${idx}`,
              ...row
            };
          }
        });
        return { success: true, data: processedData, count: processedData.length };
      } catch (error: any) {
        if (!silent) toast({ variant: "destructive", title: `Erro na Planilha (${mode})`, description: error.message });
        return { success: false, data: [] };
      }
    };
    
    const [inventoryResult, leadsResult, salesResult] = await Promise.all([
      processSheet(urls.inventory, 'inventory'),
      processSheet(urls.leads, 'leads'),
      processSheet(urls.sales, 'sales')
    ]);

    if (inventoryResult.success) setInventory(inventoryResult.data);
    if (leadsResult.success) setLeads(leadsResult.data);
    if (salesResult.success) setSales(salesResult.data);

    syncingRef.current = false;
    setSyncing(false);
    if (!silent) {
      toast({ title: "Sincronização Concluída", description: `Dados das planilhas foram atualizados.` });
    }
  }, [urls, toast, auth, user]);

  // Auto-sync effect
  useEffect(() => {
    if (!auth || !user || (!urls.inventory && !urls.leads && !urls.sales)) return;

    handleSync(true); // Initial sync
    const intervalId = setInterval(() => handleSync(true), 60000); // Sync every 60 seconds
    
    return () => clearInterval(intervalId);
  }, [urls, handleSync, auth, user]);
  
  const processedSales = useMemo(() => sales.map(s => ({
    ...s,
    saleDateObj: toDate(s.saleDate),
    propertyCaptureDateObj: toDate(s.propertyCaptureDate),
  })), [sales]);

  const processedInventory = useMemo(() => inventory.map(p => ({
    ...p,
    captureDateObj: toDate(p.captureDate),
  })), [inventory]);


  const metrics = useMemo(() => {
    const filterByDate = (items: any[], dateField: keyof (typeof items)[0]) => {
        return items.filter(item => {
            const d = item[dateField];
            if (!d) return false;
            const monthMatch = selectedMonth === "all" || d.getMonth() === parseInt(selectedMonth);
            const yearMatch = selectedYear === "all" || d.getFullYear() === parseInt(selectedYear);
            return monthMatch && yearMatch;
        });
    };

    const filteredSales = filterByDate(processedSales, 'saleDateObj');
    const filteredProperties = filterByDate(processedInventory, 'captureDateObj');

    const totalDaysSinceStart = 427; 
    const salesFrequency = sales.length > 0 ? totalDaysSinceStart / sales.length : 0;

    const validCycles = processedSales.map(s => {
      const start = s.propertyCaptureDateObj;
      const end = s.saleDateObj;
      if (start && end) return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return null;
    }).filter((d): d is number => d !== null && d >= 0);
    
    const avgDaysToSell = validCycles.length > 0 ? validCycles.reduce((a, b) => a + b, 0) / validCycles.length : 0;

    const salePropsInventory = inventory.filter(p => (Number(p.saleValue) || 0) > 0);
    const avgTicket = salePropsInventory.length > 0 ? salePropsInventory.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0) / salePropsInventory.length : 0;

    const rentPropsInventory = inventory.filter(p => (Number(p.rentalValue) || 0) > 0);
    const avgTicketRent = rentPropsInventory.length > 0 ? rentPropsInventory.reduce((acc, p) => acc + (Number(p.rentalValue) || 0), 0) / rentPropsInventory.length : 0;

    const allSaleDates = processedSales
      .map(s => s.saleDateObj)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    const lastSaleDate = allSaleDates[0];
    const daysSinceLastSale = lastSaleDate ? Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    return {
      avgDaysToSell,
      avgDaysToRent: 0,
      totalValue: inventory.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0),
      lastSaleDisplay: daysSinceLastSale !== null ? `${Math.max(0, daysSinceLastSale)} Dias` : "-",
      totalLeads: leads.length,
      totalSales: filteredSales.length,
      totalProperties: filteredProperties.length,
      avgTicket,
      avgTicketRent,
      salesFrequency
    };
  }, [processedSales, leads, processedInventory, inventory, now, selectedMonth, selectedYear]);

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
             <Button variant="ghost" size="icon" onClick={() => handleSync(false)} disabled={syncing} aria-label="Sincronizar dados">
                <RefreshCcw className={`h-5 w-5 text-primary ${syncing ? 'animate-spin' : ''}`} />
             </Button>
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
                  {[...Array(3)].map((_, i) => (
                    <SelectItem key={i} value={String(now.getFullYear() - i)}>
                      {now.getFullYear() - i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-sm mx-auto h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg"><LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard</TabsTrigger>
            <TabsTrigger value="config" className="rounded-lg"><Settings className="h-4 w-4 mr-2" /> Config</TabsTrigger>
          </TabsList>
          
          {(!urls.inventory || !urls.leads || !urls.sales) && (
            <Card className="mt-6 bg-amber-50 border-amber-200">
                <CardHeader className="flex flex-row items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <div>
                        <CardTitle className="text-amber-800">Ação Necessária</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Para começar, por favor, vá até a aba 'Config' e insira os links das suas planilhas.
                        </p>
                    </div>
                </CardHeader>
            </Card>
          )}

          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in duration-500">
            <StatsCards metrics={metrics} />
            <InventoryHealth 
              properties={inventory} 
              sales={sales}
              targets={targets}
              onTargetsChange={handleTargetsChange}
              brokers={allBrokers}
            />
            <div className="space-y-6">
              <MonthlyTrends sales={sales} leads={leads} properties={inventory} />
              <BrokerPerformanceGrid 
                sales={sales} 
                leads={leads} 
                properties={inventory} 
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                brokers={allBrokers}
              />
              <ChannelPerformance leads={leads} />
            </div>
          </TabsContent>
          
          <TabsContent value="config" className="space-y-6">
            <SheetUrlConfig urls={urls} onUrlsChange={handleUrlsChange} />
            <BrokerSettings 
              brokers={allBrokers} 
              onAddBroker={handleAddBroker}
              onDeleteBroker={handleDeleteBroker} 
            />
          </TabsContent>
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

    