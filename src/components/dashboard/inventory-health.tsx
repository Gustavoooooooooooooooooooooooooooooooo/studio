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
      captures: { annual: number; quarterly: number; semiannual: number; };
      sales: { annual: number; quarterly: number; semiannual: number; };
      rentals: { annual: number; quarterly: number; semiannual: number; };
    }
  };
  onTargetsChange: (newTargets: PerformanceGoalsProps['targets']) => void;
  brokers: string[];
}

export function InventoryHealth({ properties, sales, targets, onTargetsChange, brokers }: PerformanceGoalsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const emptyTarget = useMemo(() => ({
    captures: { annual: 0, quarterly: 0, semiannual: 0 },
    sales: { annual: 0, quarterly: 0, semiannual: 0 },
    rentals: { annual: 0, quarterly: 0, semiannual: 0 },
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

  const brokerPerformance = useMemo(() => {
    if (!brokers || brokers.length === 0) return [];
    
    const performance = brokers.map(brokerName => {
        const normBrokerName = normalize(brokerName).split(' ')[0];
        
        const brokerSales = sales.filter(s => {
            const normVendedor = normalize(s.vendedor || '').split(' ')[0];
            const isSaleType = normalize(s.tipo || '').includes('venda');
            return normVendedor === normBrokerName && isSaleType;
        });
        
        const brokerRentals = sales.filter(s => {
            const normVendedor = normalize(s.vendedor || '').split(' ')[0];
            const isRentalType = normalize(s.tipo || '').includes('loca') || normalize(s.tipo || '').includes('aluguel');
            return normVendedor === normBrokerName && isRentalType;
        });

        const brokerCaptures = properties.filter(p => {
             const normBroker = normalize(p.brokerId || '').split(' ')[0];
             return normBroker === normBrokerName;
        });

        const brokerTargets = targets[brokerName] || emptyTarget;

        return {
            name: brokerName,
            salesCount: brokerSales.length,
            rentalsCount: brokerRentals.length,
            capturesCount: brokerCaptures.length,
            salesGoal: brokerTargets.sales.annual,
            rentalsGoal: brokerTargets.rentals.annual,
            capturesGoal: brokerTargets.captures.annual,
        };
    });

    return performance
      .filter(broker => broker.salesGoal > 0 || broker.rentalsGoal > 0 || broker.capturesGoal > 0)
      .sort((a,b) => a.name.localeCompare(b.name));

  }, [brokers, sales, properties, targets, emptyTarget, normalize]);

  const handleInputChange = (brokerKey: string, category: 'captures' | 'sales' | 'rentals', period: 'annual' | 'semiannual' | 'quarterly', value: string) => {
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
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Metas de Performance
            </h2>
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
                                    <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-accent"><Building className="h-5 w-5"/> Metas de Angariação</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`captures-annual-${brokerKey}`}>Anual</Label>
                                        <Input id={`captures-annual-${brokerKey}`} type="number" value={currentBrokerTargets.captures.annual} onChange={(e) => handleInputChange(brokerKey, 'captures', 'annual', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`captures-semiannual-${brokerKey}`}>Semestral</Label>
                                        <Input id={`captures-semiannual-${brokerKey}`} type="number" value={currentBrokerTargets.captures.semiannual} onChange={(e) => handleInputChange(brokerKey, 'captures', 'semiannual', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`captures-quarterly-${brokerKey}`}>Trimestral</Label>
                                        <Input id={`captures-quarterly-${brokerKey}`} type="number" value={currentBrokerTargets.captures.quarterly} onChange={(e) => handleInputChange(brokerKey, 'captures', 'quarterly', e.target.value)} />
                                    </div>
                                    </div>
                                </div>
                                
                                <div className="p-4 border rounded-lg bg-muted/20">
                                    <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><BadgeDollarSign className="h-5 w-5"/> Metas de Vendas</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`sales-annual-${brokerKey}`}>Anual</Label>
                                        <Input id={`sales-annual-${brokerKey}`} type="number" value={currentBrokerTargets.sales.annual} onChange={(e) => handleInputChange(brokerKey, 'sales', 'annual', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`sales-semiannual-${brokerKey}`}>Semestral</Label>
                                        <Input id={`sales-semiannual-${brokerKey}`} type="number" value={currentBrokerTargets.sales.semiannual} onChange={(e) => handleInputChange(brokerKey, 'sales', 'semiannual', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`sales-quarterly-${brokerKey}`}>Trimestral</Label>
                                        <Input id={`sales-quarterly-${brokerKey}`} type="number" value={currentBrokerTargets.sales.quarterly} onChange={(e) => handleInputChange(brokerKey, 'sales', 'quarterly', e.target.value)} />
                                    </div>
                                    </div>
                                </div>

                                <div className="p-4 border rounded-lg bg-muted/20">
                                    <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-emerald-600"><Key className="h-5 w-5"/> Metas de Locação</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`rentals-annual-${brokerKey}`}>Anual</Label>
                                        <Input id={`rentals-annual-${brokerKey}`} type="number" value={currentBrokerTargets.rentals.annual} onChange={(e) => handleInputChange(brokerKey, 'rentals', 'annual', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`rentals-semiannual-${brokerKey}`}>Semestral</Label>
                                        <Input id={`rentals-semiannual-${brokerKey}`} type="number" value={currentBrokerTargets.rentals.semiannual} onChange={(e) => handleInputChange(brokerKey, 'rentals', 'semiannual', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`rentals-quarterly-${brokerKey}`}>Trimestral</Label>
                                        <Input id={`rentals-quarterly-${brokerKey}`} type="number" value={currentBrokerTargets.rentals.quarterly} onChange={(e) => handleInputChange(brokerKey, 'rentals', 'quarterly', e.target.value)} />
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
                const capturesProgress = broker.capturesGoal > 0 ? Math.min(100, (broker.capturesCount / broker.capturesGoal) * 100) : 0;
                const salesProgress = broker.salesGoal > 0 ? Math.min(100, (broker.salesCount / broker.salesGoal) * 100) : 0;
                const rentalsProgress = broker.rentalsGoal > 0 ? Math.min(100, (broker.rentalsCount / broker.rentalsGoal) * 100) : 0;
                
                return (
                <Card key={broker.name} className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {broker.name}
                    </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                    {broker.capturesGoal > 0 && (
                        <div>
                        <div className="flex justify-between items-center text-muted-foreground">
                            <span>Angariações</span>
                            <span className="font-bold text-foreground">{broker.capturesCount}/{broker.capturesGoal}</span>
                        </div>
                        <Progress value={capturesProgress} className="h-1.5 mt-1 [&>div]:bg-accent" />
                        </div>
                    )}
                    {broker.salesGoal > 0 && (
                        <div>
                        <div className="flex justify-between items-center text-muted-foreground">
                            <span>Vendas</span>
                            <span className="font-bold text-foreground">{broker.salesCount}/{broker.salesGoal}</span>
                        </div>
                        <Progress value={salesProgress} className="h-1.5 mt-1 [&>div]:bg-primary" />
                        </div>
                    )}
                    {broker.rentalsGoal > 0 && (
                        <div>
                        <div className="flex justify-between items-center text-muted-foreground">
                            <span>Locações</span>
                            <span className="font-bold text-foreground">{broker.rentalsCount}/{broker.rentalsGoal}</span>
                        </div>
                        <Progress value={rentalsProgress} className="h-1.5 mt-1 [&>div]:bg-emerald-600" />
                        </div>
                    )}
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
