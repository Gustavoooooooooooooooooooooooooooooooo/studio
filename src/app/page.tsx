
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutDashboard, TrendingUp, Table2, Settings, Calendar as CalendarIcon, Loader2, AlertTriangle, RefreshCcw } from "lucide-react";
import { useFirebase, initiateAnonymousSignIn } from "@/firebase";
import { syncGoogleSheets } from "@/ai/flows/sync-sheets-flow";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


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
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([String(now.getFullYear())]);
  const [syncing, setSyncing] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
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
              advertisedValue: parseCurrency(getVal(row, ["valor anuncio", "anuncio", "qual valor anunciado?"])),
              closedValue: parseCurrency(getVal(row, ["valor fechado", "valor venda", "qual valor final de venda?"])),
              commission: parseCurrency(getVal(row, ["comissao", "comissão"])),
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
            const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(String(d.getMonth()));
            const yearMatch = selectedYears.length === 0 || selectedYears.includes(String(d.getFullYear()));
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

    const normalizeTipo = (tipo: any) => String(tipo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const salesForDiscount = filteredSales.filter(s => normalizeTipo(s.tipo).includes('venda') && s.advertisedValue > 0 && s.closedValue > 0 && s.advertisedValue >= s.closedValue);
    const totalSaleDiscountPercent = salesForDiscount.reduce((acc, s) => acc + ((s.advertisedValue - s.closedValue) / s.advertisedValue), 0);
    const avgDiscountSale = salesForDiscount.length > 0 ? (totalSaleDiscountPercent / salesForDiscount.length) * 100 : 0;
    const totalSaleDiscountValue = salesForDiscount.reduce((acc, s) => acc + (s.advertisedValue - s.closedValue), 0);
    const avgDiscountValueSale = salesForDiscount.length > 0 ? totalSaleDiscountValue / salesForDiscount.length : 0;

    const rentalsForDiscount = filteredSales.filter(s => normalizeTipo(s.tipo).includes('loca') && s.advertisedValue > 0 && s.closedValue > 0 && s.advertisedValue >= s.closedValue);
    const totalRentDiscountPercent = rentalsForDiscount.reduce((acc, s) => acc + ((s.advertisedValue - s.closedValue) / s.advertisedValue), 0);
    const avgDiscountRent = rentalsForDiscount.length > 0 ? (totalRentDiscountPercent / rentalsForDiscount.length) * 100 : 0;
    const totalRentDiscountValue = rentalsForDiscount.reduce((acc, s) => acc + (s.advertisedValue - s.closedValue), 0);
    const avgDiscountValueRent = rentalsForDiscount.length > 0 ? totalRentDiscountValue / rentalsForDiscount.length : 0;

    const salesForCommission = filteredSales.filter(s => normalizeTipo(s.tipo).includes('venda') && s.commission > 0);
    const totalSaleCommission = salesForCommission.reduce((acc, s) => acc + s.commission, 0);
    const avgCommissionSale = salesForCommission.length > 0 ? totalSaleCommission / salesForCommission.length : 0;

    const rentalsForCommission = filteredSales.filter(s => normalizeTipo(s.tipo).includes('loca') && s.commission > 0);
    const totalRentCommission = rentalsForCommission.reduce((acc, s) => acc + s.commission, 0);
    const avgCommissionRent = rentalsForCommission.length > 0 ? totalRentCommission / rentalsForCommission.length : 0;

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
      salesFrequency,
      avgDiscountSale,
      avgDiscountRent,
      avgDiscountValueSale,
      avgDiscountValueRent,
      avgCommissionSale,
      avgCommissionRent
    };
  }, [processedSales, leads, processedInventory, inventory, now, selectedMonths, selectedYears]);

  const monthOptions = [
    { value: '0', label: 'Janeiro' }, { value: '1', label: 'Fevereiro' }, { value: '2', label: 'Março' },
    { value: '3', label: 'Abril' }, { value: '4', label: 'Maio' }, { value: '5', label: 'Junho' },
    { value: '6', label: 'Julho' }, { value: '7', label: 'Agosto' }, { value: '8', label: 'Setembro' },
    { value: '9', label: 'Outubro' }, { value: '10', label: 'Novembro' }, { value: '11', label: 'Dezembro' }
  ];
  
  const yearOptions = [...Array(5)].map((_, i) => ({
    value: String(now.getFullYear() - i),
    label: String(now.getFullYear() - i)
  }));

  const handleMonthSelect = (month: string) => {
    setSelectedMonths(prev => {
      const newSelection = prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month];
      return newSelection;
    });
  };

  const handleYearSelect = (year: string) => {
    setSelectedYears(prev => {
      const newSelection = prev.includes(year)
        ? prev.filter(y => y !== year)
        : [...prev, year];
      return newSelection;
    });
  };

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
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 border-none bg-transparent shadow-none focus:ring-0 px-2 text-sm">
                    <span className="truncate max-w-[120px]">
                      {selectedMonths.length === 0 
                        ? "Todos os Meses" 
                        : selectedMonths.length === 1 
                          ? monthOptions.find(m => m.value === selectedMonths[0])?.label 
                          : `${selectedMonths.length} meses`}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Filtrar por Mês</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                      checked={selectedMonths.length === 0}
                      onCheckedChange={() => setSelectedMonths([])}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Todos os Meses
                    </DropdownMenuCheckboxItem>
                  {monthOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedMonths.includes(option.value)}
                      onCheckedChange={() => handleMonthSelect(option.value)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-[1px] h-4 bg-muted-foreground/20 mx-1" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 border-none bg-transparent shadow-none focus:ring-0 px-2 text-sm">
                     <span className="truncate max-w-[100px]">
                      {selectedYears.length === 0 
                        ? "Todos os Anos" 
                        : selectedYears.length === 1 
                          ? selectedYears[0] 
                          : `${selectedYears.length} anos`}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Filtrar por Ano</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                      checked={selectedYears.length === 0}
                      onCheckedChange={() => setSelectedYears([])}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Todos os Anos
                    </DropdownMenuCheckboxItem>
                  {yearOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedYears.includes(option.value)}
                      onCheckedChange={() => handleYearSelect(option.value)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsConfigOpen(true)}>
                <Settings className="h-5 w-5 text-primary" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {(!urls.inventory || !urls.leads || !urls.sales) && (
            <Card className="mb-6 bg-amber-50 border-amber-200">
                <CardHeader className="flex flex-row items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <div>
                        <CardTitle className="text-amber-800">Ação Necessária</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Para começar, por favor, clique no ícone de engrenagem e insira os links das suas planilhas.
                        </p>
                    </div>
                </CardHeader>
            </Card>
          )}

          <div className="space-y-8 animate-in fade-in duration-500">
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
                selectedMonths={selectedMonths}
                selectedYears={selectedYears}
                brokers={allBrokers}
              />
              <ChannelPerformance leads={leads} />
            </div>
          </div>
      </main>

      <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <SheetContent className="sm:max-w-lg w-[90vw]">
          <SheetHeader>
            <SheetTitle className="text-xl flex items-center gap-2 text-primary">
              <Settings className="h-5 w-5" />
              Configurações
            </SheetTitle>
            <SheetDescription>
              Gerencie os links para suas planilhas e a lista de corretores para análise.
            </SheetDescription>
          </SheetHeader>
          <div className="py-8 space-y-8">
            <SheetUrlConfig urls={urls} onUrlsChange={handleUrlsChange} />
            <BrokerSettings 
              brokers={allBrokers} 
              onAddBroker={handleAddBroker}
              onDeleteBroker={handleDeleteBroker} 
            />
          </div>
        </SheetContent>
      </Sheet>


      <footer className="mt-12 py-8 border-t bg-white">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ImmoSales Insight. Inteligência Real em Gestão Imobiliária.
        </div>
      </footer>
    </div>
  );
}
