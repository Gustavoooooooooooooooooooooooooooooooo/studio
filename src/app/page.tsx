
"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { MonthlyTrends } from "@/components/dashboard/monthly-trends";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, Settings, Calendar as CalendarIcon, AlertTriangle, RefreshCcw, Trophy } from "lucide-react";
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
import { ClientOnly } from "@/components/client-only";
import { doc, onSnapshot, setDoc, type DocumentReference } from "firebase/firestore";


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
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
    const date = new Date(Date.UTC(year, month, day));
    return isNaN(date.getTime()) ? null : date;
  }
  
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

// Helper functions from the old google-sheets-sync component
const getVal = (row: any, searchKeys: string[], excludeKeys: string[] = []) => {
    if (!row) return undefined;
    const rowKeys = Object.keys(row);
    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const normalizedSearch = searchKeys.map(normalize);
    const normalizedExclude = excludeKeys.map(normalize);

    if (searchKeys.some(k => k === "origem do lead?")) {
        const exactMatchKey = rowKeys.find(rk => rk.trim() === "origem do lead?");
        if (exactMatchKey) {
            return row[exactMatchKey];
        }
    }

    for (const sKey of normalizedSearch) {
      const match = rowKeys.find(rk => normalize(rk) === sKey);
      if (match) {
        const val = row[match];
        if (sKey.includes("data") || sKey.includes("carimbo")) {
          if (val && !/\d/.test(String(val))) continue;
        }
        return val;
      }
    }

    for (const sKey of normalizedSearch) {
      const match = rowKeys.find(rk => {
        const nrk = normalize(rk);
        const isMatch = nrk.includes(sKey);
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


function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [now] = useState<Date>(new Date());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([String(now.getFullYear())]);
  const [syncing, setSyncing] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { toast } = useToast();

  // States for shared config, will be populated from Firestore
  const [urls, setUrls] = useState({ inventory: "", leads: "", sales: "", rentals: "", logo: "" });
  const [manualBrokers, setManualBrokers] = useState<string[]>([]);
  const [targets, setTargets] = useState<{
    [key: string]: {
      capturesSale: { annual: number; quarterly: number; semiannual: number; };
      capturesRent: { annual: number; quarterly: number; semiannual: number; };
    }
  }>({
    global: {
      capturesSale: { annual: 250, quarterly: 65, semiannual: 125 },
      capturesRent: { annual: 150, quarterly: 40, semiannual: 75 },
    }
  });

  // Data states (local to the session)
  const [leads, setLeads] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  const { auth, user, isUserLoading, firestore } = useFirebase();
  const syncingRef = useRef(false);
  const [configDocRef, setConfigDocRef] = useState<DocumentReference | null>(null);

  // Effect to handle anonymous sign-in
  useEffect(() => {
    if (auth && !user && !isUserLoading) {
      initiateAnonymousSignIn(auth, toast);
    }
  }, [auth, user, isUserLoading, toast]);
  
  // Effect to get Firestore doc reference for the shared config
  useEffect(() => {
    if (firestore) {
      setConfigDocRef(doc(firestore, "app_config", "dashboard_settings"));
    }
  }, [firestore]);

  // Effect to listen for real-time config changes from Firestore
  useEffect(() => {
    if (!configDocRef) return;

    const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUrls(data.urls || { inventory: "", leads: "", sales: "", rentals: "", logo: "" });
        setManualBrokers(data.manualBrokers || []);
        
        const savedTargets = data.targets;
        if (savedTargets) {
          try {
            if (savedTargets.global && (savedTargets.global.capturesSale !== undefined || savedTargets.global.captures !== undefined)) {
                const parsed = JSON.parse(JSON.stringify(savedTargets)); // deep copy
                if (parsed.global.captures && parsed.global.capturesSale === undefined) {
                    Object.keys(parsed).forEach(key => {
                        const oldCaptures = parsed[key].captures;
                        if (oldCaptures) {
                            parsed[key].capturesSale = { 
                                annual: Math.round(oldCaptures.annual * 0.6), 
                                quarterly: Math.round(oldCaptures.quarterly * 0.6), 
                                semiannual: Math.round(oldCaptures.semiannual * 0.6) 
                            };
                            parsed[key].capturesRent = { 
                                annual: Math.round(oldCaptures.annual * 0.4), 
                                quarterly: Math.round(oldCaptures.quarterly * 0.4), 
                                semiannual: Math.round(oldCaptures.semiannual * 0.4)
                            };
                            delete parsed[key].captures;
                        }
                    });
                }
                if (parsed.global.capturesSale) {
                    setTargets(parsed);
                }
            }
          } catch (e) {
            console.error("Failed to parse targets from Firestore", e);
            setTargets({ global: { capturesSale: { annual: 250, quarterly: 65, semiannual: 125 }, capturesRent: { annual: 150, quarterly: 40, semiannual: 75 } } });
          }
        }
      } else {
        console.log("No config document found in Firestore. Using initial state. First save will create the document.");
      }
    });

    return () => unsubscribe();
  }, [configDocRef]);


  useEffect(() => {
    setMounted(true);
  },[])

  // Handlers now write to Firestore instead of localStorage
  const handleUrlsChange = (newUrls: { inventory: string; leads: string; sales: string; rentals: string; logo: string; }) => {
    if (configDocRef) {
      setDoc(configDocRef, { urls: newUrls }, { merge: true }).then(() => {
        toast({
          title: "Configurações Salvas",
          description: "Os links das planilhas foram salvos na nuvem.",
        });
      });
      handleSync(false, newUrls);
    }
  };
  
  const handleAddBroker = useCallback((brokerName: string) => {
    const trimmedBrokerName = brokerName.trim();
    if (!trimmedBrokerName || !configDocRef) return;

    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const brokerExists = manualBrokers.some(b => normalize(b) === normalize(trimmedBrokerName));
  
    if (brokerExists) {
      setTimeout(() => toast({ variant: "destructive", title: "Corretor já existe", description: `"${trimmedBrokerName}" já está na sua lista.` }), 0);
      return;
    }
      
    const updatedBrokers = [...manualBrokers, trimmedBrokerName];
    setDoc(configDocRef, { manualBrokers: updatedBrokers }, { merge: true }).then(() => {
      setTimeout(() => toast({ title: "Corretor Adicionado", description: `"${trimmedBrokerName}" foi adicionado à lista.` }), 0);
    });
  }, [manualBrokers, configDocRef, toast]);
  
  const handleDeleteBroker = useCallback((brokerNameToDelete: string) => {
    if (!configDocRef) return;
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const updatedBrokers = manualBrokers.filter(b => normalize(b) !== normalize(brokerNameToDelete));
      
    setDoc(configDocRef, { manualBrokers: updatedBrokers }, { merge: true }).then(() => {
      setTimeout(() => toast({ title: "Corretor Removido", description: `"${brokerNameToDelete}" foi removido da lista.` }), 0);
    });
  }, [manualBrokers, configDocRef, toast]);

  const handleTargetsChange = useCallback((newTargets: typeof targets) => {
    if (configDocRef) {
      setDoc(configDocRef, { targets: newTargets }, { merge: true }).then(() => {
        toast({ title: "Metas Atualizadas", description: "As novas metas de performance foram salvas na nuvem." });
      });
    }
  }, [configDocRef, toast]);
  
  const allBrokers = useMemo(() => {
    return [...manualBrokers].sort();
  }, [manualBrokers]);

  const handleSync = useCallback(async (silent = false, syncUrls = urls) => {
    if (syncingRef.current) return;
    
    setSyncing(true);
    syncingRef.current = true;

    try {
      const processSheet = async (url: string, mode: 'inventory' | 'sales' | 'leads', dealType?: 'Venda' | 'Locação') => {
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
              
              if (dealType === 'Locação') {
                return {
                  id: `${propertyCode}-${idx}`,
                  vendedor: String(getVal(row, ["vendedor", "corretor", "responsavel", "atendente"]) || "N/A"),
                  angariador: String(getVal(row, ["angariador", "captador"]) || "N/A"),
                  propertyCode,
                  neighborhood: String(getVal(row, ["bairro", "localizacao"]) || "N/A"),
                  clientName: String(getVal(row, ["locatario", "inquilino", "cliente"]) || "N/A"),
                  advertisedValue: parseCurrency(getVal(row, ["valor do aluguel", "valor locacao", "aluguel", "anuncio", "valor do anuncio", "valor anuncio", "valor do anúncio"])),
                  closedValue: parseCurrency(getVal(row, ["valor aluguel fechado", "valor final locacao", "valor fechado", "negocio fechado", "negócio fechado"])),
                  commission: parseCurrency(getVal(row, ["comissao", "comissão"])),
                  saleDate: formatDateDisplay(getVal(row, ["data locacao", "data do contrato", "fechamento", "negocio fechado", "negócio fechado"], ["vendedor"])),
                  propertyCaptureDate: formatDateDisplay(getVal(row, ["entrada do imovel", "data entrada", "cadastro", "carimbo"])),
                  origem: String(getVal(row, ["origem", "origem do lead?"]) || "N/A"),
                  tipo: 'Locação',
                  status: 'Alugado',
                };
              } else {
                return {
                  id: `${propertyCode}-${idx}`,
                  vendedor: String(getVal(row, ["vendedor", "corretor", "responsavel"]) || "N/A"),
                  angariador: String(getVal(row, ["angariador", "captador"]) || "N/A"),
                  propertyCode,
                  neighborhood: String(getVal(row, ["bairro", "localizacao"]) || "N/A"),
                  clientName: String(getVal(row, ["cliente", "comprador"]) || "N/A"),
                  advertisedValue: parseCurrency(getVal(row, ["valor do anuncio", "valor anuncio", "anuncio", "qual valor anunciado?"])),
                  closedValue: parseCurrency(getVal(row, ["valor fechado", "valor venda", "qual valor final de venda?", "negocio fechado", "negócio fechado"])),
                  commission: parseCurrency(getVal(row, ["comissao", "comissão"])),
                  saleDate: formatDateDisplay(getVal(row, ["data do venda", "data venda", "fechamento", "venda"], ["vendedor", "corretor"])),
                  propertyCaptureDate: formatDateDisplay(getVal(row, ["entrada do imovel", "data entrada", "cadastro", "carimbo"])),
                  origem: String(getVal(row, ["origem do lead?"]) || "N/A"),
                  tipo: 'Venda',
                  status: 'Vendido',
                };
              }
            } else {
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
      
      const [inventoryResult, leadsResult, salesResult, rentalsResult] = await Promise.all([
        processSheet(syncUrls.inventory, 'inventory'),
        processSheet(syncUrls.leads, 'leads'),
        processSheet(syncUrls.sales, 'sales', 'Venda'),
        processSheet(syncUrls.rentals, 'sales', 'Locação')
      ]);

      if (inventoryResult.success) setInventory(inventoryResult.data);
      if (leadsResult.success) setLeads(leadsResult.data);
      
      const combinedSales = [];
      if (salesResult.success) combinedSales.push(...salesResult.data);
      if (rentalsResult.success) combinedSales.push(...rentalsResult.data);
      setSales(combinedSales);

      if (!silent) {
        toast({ title: "Sincronização Concluída", description: `Dados das planilhas foram atualizados.` });
      }
    } catch (e) {
        console.error("Sincronização falhou", e);
        if(!silent) {
            toast({ variant: "destructive", title: `Erro inesperado na sincronização`, description: e instanceof Error ? e.message : 'Verifique o console para mais detalhes.' });
        }
    } finally {
        setSyncing(false);
        syncingRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    if (!urls.inventory && !urls.leads && !urls.sales && !urls.rentals) return;

    handleSync(true, urls);
    const intervalId = setInterval(() => handleSync(true, urls), 300000);
    
    return () => clearInterval(intervalId);
  }, [urls, handleSync]);
  
  const processedSales = useMemo(() => sales.map(s => ({
    ...s,
    saleDateObj: toDate(s.saleDate),
    propertyCaptureDateObj: toDate(s.propertyCaptureDate),
  })), [sales]);

  const processedInventory = useMemo(() => inventory.map(p => ({
    ...p,
    captureDateObj: toDate(p.captureDate),
  })), [inventory]);

  const processedLeads = useMemo(() => leads.map(l => {
      const getLeadDate = (lead: any) => {
          const keys = Object.keys(lead);
          const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const dateKey = keys.find(k => {
              const nk = normalize(k);
              return nk.includes("data") || nk.includes("carimbo") || nk.includes("criado");
          });
          return dateKey ? toDate(lead[dateKey]) : null;
      }
      return {
          ...l,
          dateObj: getLeadDate(l)
      };
  }), [leads]);

  const metrics = useMemo(() => {
    const normalize = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const filterByDate = (items: any[], dateField: keyof (typeof items)[0]) => {
        return items.filter(item => {
            const d = item[dateField];
            if (!d) return false;
            const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(String(d.getUTCMonth()));
            const yearMatch = selectedYears.length === 0 || selectedYears.includes(String(d.getUTCFullYear()));
            return monthMatch && yearMatch;
        });
    };

    const filteredSales = filterByDate(processedSales, 'saleDateObj');
    const filteredProperties = filterByDate(processedInventory, 'captureDateObj');
    const filteredLeads = filterByDate(processedLeads, 'dateObj');
    
    const salesForFrequencyCalc = processedSales.filter(s => {
      const d = s.saleDateObj;
      if (!d) return false;
      const isSaleType = normalize(s.tipo) === 'venda';
      const yearMatch = selectedYears.length === 0 || selectedYears.includes(String(d.getUTCFullYear()));
      return isSaleType && yearMatch;
    });

    const totalVGVFechado = filteredSales
      .filter(s => !normalize(s.tipo).includes('loca') && !normalize(s.tipo).includes('aluguel'))
      .reduce((acc, s) => acc + (s.closedValue || 0), 0);
      
    const totalVGLFechado = filteredSales
      .filter(s => normalize(s.tipo).includes('loca') || normalize(s.tipo).includes('aluguel'))
      .reduce((acc, s) => acc + (s.closedValue || 0), 0);

    let salesFrequency = 0;
    if (salesForFrequencyCalc.length > 0) {
        const yearsToConsider = selectedYears.length > 0 ? selectedYears.map(y => parseInt(y)) : [now.getFullYear()];
        const minYear = Math.min(...yearsToConsider);
        const startOfPeriod = new Date(Date.UTC(minYear, 0, 1));
        const endOfPeriod = now;
        const totalDays = Math.ceil((endOfPeriod.getTime() - startOfPeriod.getTime()) / (1000 * 60 * 60 * 24));
        if (totalDays > 0) {
            salesFrequency = totalDays / salesForFrequencyCalc.length;
        }
    }
    
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
      .filter(s => normalize(s.tipo) === 'venda')
      .map(s => s.saleDateObj)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    const lastSaleDate = allSaleDates[0];
    const daysSinceLastSale = lastSaleDate ? Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const salesForDiscount = filteredSales.filter(s => 
      !normalize(s.tipo).includes('loca') && 
      !normalize(s.tipo).includes('aluguel') && 
      s.advertisedValue > 0 && 
      s.closedValue > 0 && 
      s.advertisedValue >= s.closedValue
    );
    const totalSaleDiscountPercent = salesForDiscount.reduce((acc, s) => acc + ((s.advertisedValue - s.closedValue) / s.advertisedValue), 0);
    const avgDiscountSale = salesForDiscount.length > 0 ? (totalSaleDiscountPercent / salesForDiscount.length) * 100 : 0;
    const totalSaleDiscountValue = salesForDiscount.reduce((acc, s) => acc + (s.advertisedValue - s.closedValue), 0);
    const avgDiscountValueSale = salesForDiscount.length > 0 ? totalSaleDiscountValue / salesForDiscount.length : 0;

    const rentalsForDiscount = filteredSales.filter(s => 
      (normalize(s.tipo).includes('loca') || normalize(s.tipo).includes('aluguel')) && 
      s.advertisedValue > 0 && 
      s.closedValue > 0 && 
      s.advertisedValue >= s.closedValue
    );
    const totalRentDiscountPercent = rentalsForDiscount.reduce((acc, s) => acc + ((s.advertisedValue - s.closedValue) / s.advertisedValue), 0);
    const avgDiscountRent = rentalsForDiscount.length > 0 ? (totalRentDiscountPercent / rentalsForDiscount.length) * 100 : 0;
    const totalRentDiscountValue = rentalsForDiscount.reduce((acc, s) => acc + (s.advertisedValue - s.closedValue), 0);
    const avgDiscountValueRent = rentalsForDiscount.length > 0 ? totalRentDiscountValue / rentalsForDiscount.length : 0;

    const salesForCommission = filteredSales.filter(s => 
      !normalize(s.tipo).includes('loca') && 
      !normalize(s.tipo).includes('aluguel') && 
      s.commission > 0
    );
    const totalSaleCommission = salesForCommission.reduce((acc, s) => acc + s.commission, 0);
    const avgCommissionSale = salesForCommission.length > 0 ? totalSaleCommission / salesForCommission.length : 0;

    const rentalsForCommission = filteredSales.filter(s => 
      (normalize(s.tipo).includes('loca') || normalize(s.tipo).includes('aluguel')) && 
      s.commission > 0
    );
    const totalRentCommission = rentalsForCommission.reduce((acc, s) => acc + s.commission, 0);
    const avgCommissionRent = rentalsForCommission.length > 0 ? totalRentCommission / rentalsForCommission.length : 0;

    const getLeadDetails = (lead: any) => {
        const entries = Object.entries(lead);
        const isLocacaoLead = entries.some(([key, val]) => {
            const nk = normalize(key);
            const nv = normalize(val);
            return (nk.includes("natureza") || nk.includes("negociacao") || nk === "tipo") && 
                   (nv.includes("loca") || nv.includes("alug"));
        });
        const hasVisit = entries.some(([key, val]) => {
          const nk = normalize(key);
          const nv = normalize(val);
          return (nk.includes("status da atividade atual") || nk.includes("visit")) && (nv.includes("realizada") || nv.includes("sim"));
        });
        return { isLocacao: isLocacaoLead, isVisit: hasVisit };
    };
    
    let leadsVenda = 0;
    let leadsLocacao = 0;
    let visitsVenda = 0;
    let visitsLocacao = 0;

    filteredLeads.forEach(l => {
        const { isLocacao, isVisit } = getLeadDetails(l);
        if (isLocacao) {
            leadsLocacao++;
            if (isVisit) visitsLocacao++;
        } else {
            leadsVenda++;
            if (isVisit) visitsVenda++;
        }
    });

    let monthsToAverage = 1;
    const currentYear = now.getUTCFullYear();
    const currentMonthIndex = now.getUTCMonth();

    if (selectedYears.length > 0) {
        if (selectedMonths.length > 0) {
            monthsToAverage = selectedYears.length * selectedMonths.length;
        } else {
            monthsToAverage = selectedYears.reduce((acc, yearStr) => {
                const year = parseInt(yearStr);
                if (year < currentYear) return acc + 12;
                if (year === currentYear) return acc + currentMonthIndex;
                return acc;
            }, 0);
        }
    } else {
        if (selectedMonths.length > 0) {
            monthsToAverage = selectedMonths.filter(m => parseInt(m) < currentMonthIndex).length;
        } else {
            monthsToAverage = currentMonthIndex;
        }
    }
    monthsToAverage = Math.max(1, monthsToAverage);

    return {
      avgDaysToSell,
      avgDaysToRent: 0,
      totalValue: inventory.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0),
      lastSaleDisplay: daysSinceLastSale !== null ? `${Math.max(0, daysSinceLastSale)} Dias` : "-",
      totalLeads: leads.length,
      totalSales: filteredSales.filter(s => normalize(s.tipo) === 'venda').length,
      totalRentals: filteredSales.filter(s => normalize(s.tipo) !== 'venda').length,
      totalProperties: filteredProperties.length,
      avgTicket,
      avgTicketRent,
      salesFrequency,
      avgDiscountSale,
      avgDiscountRent,
      avgDiscountValueSale,
      avgDiscountValueRent,
      avgCommissionSale,
      avgCommissionRent,
      totalDeals: filteredSales.length,
      avgLeadsVenda: leadsVenda / monthsToAverage,
      avgLeadsLocacao: leadsLocacao / monthsToAverage,
      avgVisitsVenda: visitsVenda / monthsToAverage,
      avgVisitsLocacao: visitsLocacao / monthsToAverage,
      totalVGVFechado,
      totalVGLFechado,
    };
  }, [processedSales, leads, processedInventory, inventory, now, selectedMonths, selectedYears, processedLeads]);

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
            {urls.logo ? (
              <img src={urls.logo} alt="Logo" className="h-12 w-auto ml-2" />
            ) : (
              <>
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-white h-5 w-5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-primary">
                  ImmoSales <span className="text-accent">Insight</span>
                </h1>
              </>
            )}
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
        {(!urls.inventory || !urls.leads || !urls.sales || !urls.rentals) && (
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
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Metas de Performance
                </h2>
                <InventoryHealth 
                  properties={inventory} 
                  sales={sales}
                  targets={targets}
                  onTargetsChange={handleTargetsChange}
                  brokers={allBrokers}
                  selectedMonths={selectedMonths}
                  selectedYears={selectedYears}
                />
            </div>
            <div className="space-y-6">
              <MonthlyTrends sales={sales} properties={inventory} />
              <BrokerPerformanceGrid 
                sales={sales} 
                leads={leads} 
                properties={inventory} 
                selectedMonths={selectedMonths}
                selectedYears={selectedYears}
                brokers={allBrokers}
              />
              <ChannelPerformance 
                leads={leads} 
                sales={sales} 
                selectedMonths={selectedMonths}
                selectedYears={selectedYears}
              />
            </div>
          </div>
      </main>

      <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <SheetContent className="sm:max-w-lg w-[90vw] p-0 flex flex-col">
          <SheetHeader className="p-6 border-b">
            <SheetTitle className="text-xl flex items-center gap-2 text-primary">
              <Settings className="h-5 w-5" />
              Configurações
            </SheetTitle>
            <SheetDescription>
              Gerencie os links para suas planilhas e a lista de corretores para análise.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <SheetUrlConfig urls={urls} onUrlsChange={handleUrlsChange} />
              <BrokerSettings 
                brokers={allBrokers} 
                onAddBroker={handleAddBroker}
                onDeleteBroker={handleDeleteBroker} 
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <footer className="mt-12 py-8 border-t bg-white">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Gestão Imobiliária.
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <ClientOnly>
      <Dashboard />
    </ClientOnly>
  );
}

    

    