
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Landmark, Target, Edit, TrendingUp, Key, Trophy, User, Scroll } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
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
  
  const emptyTarget = {
    captures: { annual: 0, quarterly: 0, semiannual: 0 },
    sales: { annual: 0, quarterly: 0, semiannual: 0 },
    rentals: { annual: 0, quarterly: 0, semiannual: 0 },
  };
  
  const [editableTargets, setEditableTargets] = useState(targets);

  useEffect(() => {
    if (isDialogOpen) {
      setEditableTargets(targets);
    }
  }, [isDialogOpen, targets]);

  const stats = useMemo(() => {
    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const currentCaptures = properties.length;
    const currentSales = sales.filter(s => normalize(s.tipo || '').includes('venda')).length;
    const currentRentals = sales.filter(s => {
        const tipo = normalize(s.tipo || '');
        return tipo.includes('loca') || tipo.includes('aluguel');
    }).length;

    const vgv = properties.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0);
    
    return { vgv, currentCaptures, currentSales, currentRentals };
  }, [properties, sales]);

  const avgComm = 0.055;
  const vgvEstoque = stats.vgv;
  const previsaoReceita = vgvEstoque * avgComm;

  const globalTargets = targets['global'] || emptyTarget;

  const capturesProgress = globalTargets.captures.annual > 0 ? Math.min(100, (stats.currentCaptures / globalTargets.captures.annual) * 100) : 0;
  const salesProgress = globalTargets.sales.annual > 0 ? Math.min(100, (stats.currentSales / globalTargets.sales.annual) * 100) : 0;
  const rentalsProgress = globalTargets.rentals.annual > 0 ? Math.min(100, (stats.currentRentals / globalTargets.rentals.annual) * 100) : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };
  
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
  
  const allTargetKeys = useMemo(() => ['global', ...brokers], [brokers]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-none shadow-sm bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
            <Landmark className="h-4 w-4" /> Saúde do Estoque & VGV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">VGV em Carteira (Real)</p>
              <h3 className="text-2xl font-bold">{formatCurrency(vgvEstoque)}</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Provisão de Receita (5.5%)</p>
              <h4 className="text-lg font-bold text-emerald-600">{formatCurrency(previsaoReceita)}</h4>
            </div>
          </div>
          <div className="pt-2 border-t border-primary/10">
             <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground font-medium">Imóveis Ativos:</span>
                <span className="font-bold">{stats.currentCaptures} unidades</span>
             </div>
             <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Ticket Médio Estoque:</span>
                <span className="font-bold">{formatCurrency(stats.currentCaptures > 0 ? vgvEstoque / stats.currentCaptures : 0)}</span>
             </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Card className="border-none shadow-sm bg-white cursor-pointer hover:bg-muted/30 transition-colors group">
            <CardHeader className="pb-2 relative">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Trophy className="h-4 w-4" /> Metas de Performance (Globais)
              </CardTitle>
              <div className="absolute top-3 right-3 p-1.5 rounded-full bg-muted/60 text-primary/50 group-hover:bg-primary group-hover:text-white transition-colors">
                <Edit className="h-3 w-3" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-accent">Meta Anual de Angariações</span>
                  <span className="font-bold text-accent">{stats.currentCaptures} / {globalTargets.captures.annual}</span>
                </div>
                <Progress value={capturesProgress} className="h-1.5 [&>div]:bg-accent" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-primary">Meta Anual de Vendas</span>
                  <span className="font-bold text-primary">{stats.currentSales} / {globalTargets.sales.annual}</span>
                </div>
                <Progress value={salesProgress} className="h-1.5 [&>div]:bg-primary" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-emerald-600">Meta Anual de Locações</span>
                  <span className="font-bold text-emerald-600">{stats.currentRentals} / {globalTargets.rentals.annual}</span>
                </div>
                <Progress value={rentalsProgress} className="h-1.5 [&>div]:bg-emerald-600" />
              </div>
            </CardContent>
          </Card>
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
                        ? <><Landmark className="h-5 w-5 text-primary" /> Metas Globais</>
                        : <><User className="h-5 w-5 text-muted-foreground" /> {brokerKey}</>
                      }
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg bg-muted/20">
                        <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-accent"><Target className="h-5 w-5"/> Metas de Angariação</h4>
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
                        <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><TrendingUp className="h-5 w-5"/> Metas de Vendas</h4>
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
  );
}
