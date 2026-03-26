

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Edit, Trophy, User, Building, BadgeDollarSign, Key } from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";


interface PerformanceGoalsProps {
  properties: any[];
  sales: any[];
  targets: {
    [key: string]: {
      capturesSale: { annual: number; quarterly: number; semiannual: number; };
      capturesRent: { annual: number; quarterly: number; semiannual: number; };
    }
  };
  onTargetsChange: (newTargets: PerformanceGoalsProps['targets']) => void;
  brokers: string[];
  selectedMonths: string[];
  selectedYears: string[];
}

export function InventoryHealth({ properties, sales, targets, onTargetsChange, brokers, selectedMonths, selectedYears }: PerformanceGoalsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const emptyTarget = useMemo(() => ({
    capturesSale: { annual: 0, quarterly: 0, semiannual: 0 },
    capturesRent: { annual: 0, quarterly: 0, semiannual: 0 },
  }), []);
  
  const [editableTargets, setEditableTargets] = useState(targets);

  useEffect(() => {
    if (isDialogOpen) {
      const newEditableTargets = JSON.parse(JSON.stringify(targets));
      brokers.forEach(b => {
        if (!newEditableTargets[b]) {
          newEditableTargets[b] = JSON.parse(JSON.stringify(emptyTarget));
        }
      });
      if (!newEditableTargets['global']) {
        newEditableTargets['global'] = JSON.parse(JSON.stringify(emptyTarget));
      }
      setEditableTargets(newEditableTargets);
    }
  }, [isDialogOpen, targets, brokers, emptyTarget]);

  const normalize = useCallback((s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), []);

  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) {
        if (isNaN(d.getTime())) return null;
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }

    const strVal = String(d).trim();
    if (!strVal || ["n/a", "undefined", "null", ""].includes(strVal.toLowerCase())) return null;

    const dmyMatch = strVal.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;
      if (day > 0 && day <= 31 && month >= 0 && month < 12) {
        const date = new Date(Date.UTC(year, month, day));
        if (!isNaN(date.getTime())) return date;
      }
    }

    const isoMatch = strVal.match(/^(\d{4})[.\/-](\d{2})[.\/-](\d{2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        if (day > 0 && day <= 31 && month >= 0 && month < 12) {
            const date = new Date(Date.UTC(year, month, day));
            if (!isNaN(date.getTime())) return date;
        }
    }
    
    if (/^\d{5}$/.test(strVal)) {
        const num = Number(strVal);
        if (!isNaN(num) && num > 30000 && num < 70000) {
            const excelEpoch = Date.UTC(1899, 11, 30);
            const date = new Date(excelEpoch + num * 86400000);
            if (!isNaN(date.getTime())) return date;
        }
    }

    const nativeDate = new Date(strVal);
    if (!isNaN(nativeDate.getTime())) {
        const utcDate = new Date(Date.UTC(nativeDate.getFullYear(), nativeDate.getMonth(), nativeDate.getDate()));
        if (!isNaN(utcDate.getTime())) return utcDate;
    }

    return null;
  };

  const brokerPerformance = useMemo(() => {
    if (!brokers || brokers.length === 0) return [];

    const filterByPeriod = (item: any, dateField: string) => {
        const d = parseDate(item[dateField]);
        if (!d) return false;
        const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(String(d.getUTCMonth()));
        const yearMatch = selectedYears.length === 0 || selectedYears.includes(String(d.getUTCFullYear()));
        return monthMatch && yearMatch;
    };
    
    const performance = brokers.map(brokerName => {
        const configBrokerName = normalize(brokerName);
        
        const isMatch = (sheetName: string | undefined | null): boolean => {
            if (!sheetName || String(sheetName).trim() === "N/A" || String(sheetName).trim() === "") return false;
            const normalizedSheetName = normalize(String(sheetName));
            if (!normalizedSheetName) return false;

            const configWords = configBrokerName.split(' ');
            const sheetWords = normalizedSheetName.split(' ');
            
            // Every word in the configured name must be present in the sheet name
            return configWords.every(cw => sheetWords.includes(cw));
        };
        
        const brokerSales = sales.filter(s => {
            const isSaleType = normalize(s.tipo || '').includes('venda');
            return isMatch(s.vendedor) && isSaleType && filterByPeriod(s, 'saleDate');
        });
        
        const brokerRentals = sales.filter(s => {
            const isRentalType = normalize(s.tipo || '').includes('loca') || normalize(s.tipo || '').includes('aluguel');
            return isMatch(s.vendedor) && isRentalType && filterByPeriod(s, 'saleDate');
        });

        const brokerCaptures = properties.filter(p => {
             const brokerField = p.brokerId || p.angariador || p.captador;
             return isMatch(brokerField) && filterByPeriod(p, 'captureDate');
        });
        
        const capturesSaleCount = brokerCaptures.filter(p => p.saleValue && Number(p.saleValue) > 0).length;
        const capturesRentCount = brokerCaptures.filter(p => p.rentalValue && Number(p.rentalValue) > 0).length;

        const brokerTargets = targets[brokerName] || emptyTarget;

        return {
            name: brokerName,
            salesCount: brokerSales.length,
            rentalsCount: brokerRentals.length,
            capturesSaleCount: capturesSaleCount,
            capturesRentCount: capturesRentCount,
            capturesSaleGoal: brokerTargets.capturesSale.annual,
            capturesRentGoal: brokerTargets.capturesRent.annual,
        };
    });

    return performance
      .filter(broker => 
        broker.capturesSaleGoal > 0 || 
        broker.capturesRentGoal > 0 ||
        broker.salesCount > 0 ||
        broker.rentalsCount > 0 ||
        broker.capturesSaleCount > 0 ||
        broker.capturesRentCount > 0
      )
      .sort((a,b) => a.name.localeCompare(b.name));

  }, [brokers, sales, properties, targets, emptyTarget, normalize, selectedMonths, selectedYears]);

  const handleInputChange = (brokerKey: string, category: 'capturesSale' | 'capturesRent', period: 'annual' | 'semiannual' | 'quarterly', value: string) => {
    const numericValue = Number(value) || 0;
    setEditableTargets(prev => {
        const newTargets = JSON.parse(JSON.stringify(prev)); 
        if (!newTargets[brokerKey]) {
            newTargets[brokerKey] = JSON.parse(JSON.stringify(emptyTarget));
        }
        newTargets[brokerKey][category][period] = numericValue;
        return newTargets;
    });
  };

  const handleSave = () => {
    onTargetsChange(editableTargets);
    setIsDialogOpen(false);
  };
  
  const allTargetKeys = useMemo(() => ['global', ...brokers.sort((a, b) => a.localeCompare(b))], [brokers]);

  return (
    <div>
        <div className="flex items-center justify-between mb-4">
            <div></div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Metas
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Editar Metas de Performance</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[65vh] pr-6 -mr-2">
                        <div className="space-y-8 pt-4">
                        {allTargetKeys.map(brokerKey => {
                            const currentBrokerTargets = editableTargets[brokerKey] || emptyTarget;
                            return (
                            <div key={brokerKey} className="border-b last:border-b-0 pb-6 last:pb-0">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                {brokerKey === 'global' 
                                    ? <><Trophy className="h-5 w-5 text-primary" /> Metas Globais</>
                                    : <><User className="h-5 w-5 text-muted-foreground" /> {brokerKey}</>
                                }
                                </h3>
                                
                                <div className="space-y-4">
                                <div className="p-4 border rounded-lg bg-muted/20">
                                    <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-accent"><Building className="h-5 w-5"/> Metas de Angariação (Venda)</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={`capturesSale-annual-${brokerKey}`}>Anual</Label>
                                            <Input id={`capturesSale-annual-${brokerKey}`} type="number" value={currentBrokerTargets.capturesSale.annual} onChange={(e) => handleInputChange(brokerKey, 'capturesSale', 'annual', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`capturesSale-semiannual-${brokerKey}`}>Semestral</Label>
                                            <Input id={`capturesSale-semiannual-${brokerKey}`} type="number" value={currentBrokerTargets.capturesSale.semiannual} onChange={(e) => handleInputChange(brokerKey, 'capturesSale', 'semiannual', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`capturesSale-quarterly-${brokerKey}`}>Trimestral</Label>
                                            <Input id={`capturesSale-quarterly-${brokerKey}`} type="number" value={currentBrokerTargets.capturesSale.quarterly} onChange={(e) => handleInputChange(brokerKey, 'capturesSale', 'quarterly', e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border rounded-lg bg-muted/20">
                                    <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-cyan-500"><Building className="h-5 w-5"/> Metas de Angariação (Locação)</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={`capturesRent-annual-${brokerKey}`}>Anual</Label>
                                            <Input id={`capturesRent-annual-${brokerKey}`} type="number" value={currentBrokerTargets.capturesRent.annual} onChange={(e) => handleInputChange(brokerKey, 'capturesRent', 'annual', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`capturesRent-semiannual-${brokerKey}`}>Semestral</Label>
                                            <Input id={`capturesRent-semiannual-${brokerKey}`} type="number" value={currentBrokerTargets.capturesRent.semiannual} onChange={(e) => handleInputChange(brokerKey, 'capturesRent', 'semiannual', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`capturesRent-quarterly-${brokerKey}`}>Trimestral</Label>
                                            <Input id={`capturesRent-quarterly-${brokerKey}`} type="number" value={currentBrokerTargets.capturesRent.quarterly} onChange={(e) => handleInputChange(brokerKey, 'capturesRent', 'quarterly', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                
                                </div>
                            </div>
                            );
                        })}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="pt-4">
                        <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={handleSave}>Salvar Todas as Metas</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

        {brokerPerformance.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {brokerPerformance.map(broker => {
                const capturesSaleProgress = broker.capturesSaleGoal > 0 ? Math.min(100, (broker.capturesSaleCount / broker.capturesSaleGoal) * 100) : 0;
                const capturesRentProgress = broker.capturesRentGoal > 0 ? Math.min(100, (broker.capturesRentCount / broker.capturesRentGoal) * 100) : 0;
                
                return (
                <Card key={broker.name} className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {broker.name}
                    </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Angariações (Venda)</span>
                        <span className="font-bold text-foreground">{broker.capturesSaleCount}/{broker.capturesSaleGoal}</span>
                      </div>
                      <Progress value={capturesSaleProgress} className="h-1.5 mt-1 [&>div]:bg-accent" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Angariações (Locação)</span>
                        <span className="font-bold text-foreground">{broker.capturesRentCount}/{broker.capturesRentGoal}</span>
                      </div>
                      <Progress value={capturesRentProgress} className="h-1.5 mt-1 [&>div]:bg-cyan-500" />
                    </div>
                    </CardContent>
                </Card>
                );
            })}
            </div>
        ) : (
            <Card className="border-dashed border-muted-foreground/30 py-12 text-center">
            <div className="text-sm text-muted-foreground">
                Nenhuma meta de corretor definida.
                <br />
                Clique em "Editar Metas" para começar.
            </div>
            </Card>
        )}
    </div>
  );
}

    
