
"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { MonthlyTrends } from "@/components/dashboard/monthly-trends";
import { SalesMatrix } from "@/components/dashboard/sales-matrix";
import { BrokerPerformanceGrid } from "@/components/dashboard/broker-performance-grid";
import { InventoryHealth } from "@/components/dashboard/inventory-health";
import { ImportedDataTable } from "@/components/dashboard/imported-data-table";
import { SalesDataTable } from "@/components/dashboard/sales-data-table";
import { LeadsDataTable } from "@/components/dashboard/leads-data-table";
import { BrokerSettings } from "@/components/dashboard/broker-settings";
import { SheetUrlConfig } from "@/components/dashboard/sheet-url-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutDashboard, TrendingUp, Table2, Users, BadgeCheck, Settings, Calendar as CalendarIcon, Loader2, AlertTriangle } from "lucide-react";
import { useFirebase, initiateAnonymousSignIn } from "@/firebase";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";


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
        if (sKey.includes("data") && val && !/\d/.test(String(val))) continue;
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
        setManualBrokers(JSON.parse(savedManualBrokers));
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
  
  const allBrokers = useMemo(() => {
    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    const brokersMap = new Map<string, string>();

    const addBrokerToMap = (name: string) => {
        const trimmedName = String(name || "").trim();
        if (!trimmedName || trimmedName === 'N/A' || trimmedName.length <= 1) return;
        
        const normalizedName = normalize(trimmedName);
        const firstName = normalizedName.split(' ')[0];

        if (!brokersMap.has(firstName) || normalizedName.length < normalize(brokersMap.get(firstName)!).length) {
            brokersMap.set(firstName, trimmedName);
        }
    };

    manualBrokers.forEach(addBrokerToMap);

    const brokerKeySubstrings = ['corretor', 'broker', 'responsavel', 'atendente', 'vendedor', 'angariador', 'captador'];

    const processItem = (item: any) => {
      if (!item) return;
      Object.entries(item).forEach(([key, value]) => {
        const normalizedKey = normalize(key);
        if (brokerKeySubstrings.some(sub => normalizedKey.includes(sub))) {
          addBrokerToMap(String(value || ''));
        }
      });
    };

    [...inventory, ...sales, ...leads].forEach(processItem);

    return Array.from(brokersMap.values())
      .map(name => {
          return name.split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()).join(' ');
      })
      .sort();
}, [inventory, sales, leads, manualBrokers]);

  const handleAddBroker = useCallback((brokerName: string) => {
    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const trimmedBrokerName = brokerName.trim();
    if (!trimmedBrokerName) return;

    const brokerExistsInManual = manualBrokers.some(b => normalize(b).split(' ')[0] === normalize(trimmedBrokerName).split(' ')[0]);

    if (brokerExistsInManual) {
        toast({ variant: "destructive", title: "Corretor já existe", description: `${trimmedBrokerName} já está na sua lista manual.` });
        return;
    }
    
    const updatedBrokers = [...manualBrokers, trimmedBrokerName];
    setManualBrokers(updatedBrokers);
    localStorage.setItem('manual_brokers', JSON.stringify(updatedBrokers));
    toast({ title: "Corretor Adicionado", description: `${trimmedBrokerName} foi adicionado à lista manual.` });

  }, [manualBrokers, toast]);

  const handleDeleteBroker = useCallback((brokerNameToDelete: string) => {
    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const firstNameToDelete = normalize(brokerNameToDelete).split(' ')[0];

    const updatedManualBrokers = manualBrokers.filter(b => {
        return normalize(b).split(' ')[0] !== firstNameToDelete;
    });
    setManualBrokers(updatedManualBrokers);
    localStorage.setItem('manual_brokers', JSON.stringify(updatedManualBrokers));

    toast({ title: "Corretor Removido", description: `${brokerNameToDelete} foi removido da sua lista manual.` });
  }, [manualBrokers, toast]);


  const handleSync = useCallback(async (silent = false) => {
    if (syncingRef.current || !auth || !user) return;
    
    syncingRef.current = true;
    if (!silent) setSyncing(true);

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
              captureDate: formatDateDisplay(getVal(row, ["data entrada", "entrada", "cadastro"])),
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
              propertyCaptureDate: formatDateDisplay(getVal(row, ["data entrada", "entrada", "cadastro"])),
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
    if (!silent) {
      setSyncing(false);
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
             {syncing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
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
          <TabsList className="grid grid-cols-6 w-full max-w-5xl mx-auto h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg"><LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard</TabsTrigger>
            <TabsTrigger value="base" className="rounded-lg"><Table2 className="h-4 w-4 mr-2" /> Base</TabsTrigger>
            <TabsTrigger value="cadastro" className="rounded-lg"><Table2 className="h-4 w-4 mr-2" /> Cadastro</TabsTrigger>
            <TabsTrigger value="leads" className="rounded-lg"><Users className="h-4 w-4 mr-2" /> Leads</TabsTrigger>
            <TabsTrigger value="conclusao" className="rounded-lg"><BadgeCheck className="h-4 w-4 mr-2" /> Conclusão</TabsTrigger>
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
            <InventoryHealth properties={inventory} />
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

          <TabsContent value="base" className="space-y-8"><SalesMatrix sales={sales} /></TabsContent>
          <TabsContent value="cadastro" className="space-y-6"><ImportedDataTable data={inventory} /></TabsContent>
          <TabsContent value="leads" className="space-y-6"><LeadsDataTable data={leads} /></TabsContent>
          <TabsContent value="conclusao" className="space-y-6"><SalesDataTable data={sales} /></TabsContent>
          <TabsContent value="config" className="space-y-6">
            <SheetUrlConfig urls={urls} onUrlsChange={handleUrlsChange} />
            <BrokerSettings 
              brokers={allBrokers} 
              manualBrokers={manualBrokers}
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

    

    


