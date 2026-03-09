
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Landmark, Target, Edit, TrendingUp, Key, Trophy, User } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


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
  const [selectedBroker, setSelectedBroker] = useState('global');

  const emptyTarget = {
    captures: { annual: 0, quarterly: 0, semiannual: 0 },
    sales: { annual: 0, quarterly: 0, semiannual: 0 },
    rentals: { annual: 0, quarterly: 0, semiannual: 0 },
  };
  
  const [editableTargets, setEditableTargets] = useState(targets[selectedBroker] || emptyTarget);

  useEffect(() => {
    setEditableTargets(targets[selectedBroker] || emptyTarget);
  }, [targets, selectedBroker, isDialogOpen]);

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

  const handleSave = () => {
    const newTargets = {
      ...targets,
      [selectedBroker]: editableTargets,
    };
    onTargetsChange(newTargets);
    setIsDialogOpen(false);
  };

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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Metas de Performance</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-4">
            <Label htmlFor="broker-select">Definir metas para</Label>
            <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                <SelectTrigger id="broker-select">
                    <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="global">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-muted-foreground" /> Metas Globais
                      </div>
                    </SelectItem>
                    {brokers.map(broker => (
                        <SelectItem key={broker} value={broker}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" /> {broker}
                          </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-6 py-4 max-h-[50vh] overflow-y-auto pr-3">
            <div className="p-4 border rounded-lg">
              <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-accent"><Target className="h-5 w-5"/> Metas de Angariação</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="captures-annual-target">Anual</Label>
                  <Input id="captures-annual-target" type="number" value={editableTargets.captures.annual} onChange={(e) => setEditableTargets(t => ({...t, captures: {...t.captures, annual: Number(e.target.value)}}))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="captures-semiannual-target">Semestral</Label>
                  <Input id="captures-semiannual-target" type="number" value={editableTargets.captures.semiannual} onChange={(e) => setEditableTargets(t => ({...t, captures: {...t.captures, semiannual: Number(e.target.value)}}))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="captures-quarterly-target">Trimestral</Label>
                  <Input id="captures-quarterly-target" type="number" value={editableTargets.captures.quarterly} onChange={(e) => setEditableTargets(t => ({...t, captures: {...t.captures, quarterly: Number(e.target.value)}}))} />
                </div>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><TrendingUp className="h-5 w-5"/> Metas de Vendas</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sales-annual-target">Anual</Label>
                  <Input id="sales-annual-target" type="number" value={editableTargets.sales.annual} onChange={(e) => setEditableTargets(t => ({...t, sales: {...t.sales, annual: Number(e.target.value)}}))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales-semiannual-target">Semestral</Label>
                  <Input id="sales-semiannual-target" type="number" value={editableTargets.sales.semiannual} onChange={(e) => setEditableTargets(t => ({...t, sales: {...t.sales, semiannual: Number(e.target.value)}}))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales-quarterly-target">Trimestral</Label>
                  <Input id="sales-quarterly-target" type="number" value={editableTargets.sales.quarterly} onChange={(e) => setEditableTargets(t => ({...t, sales: {...t.sales, quarterly: Number(e.target.value)}}))} />
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-emerald-600"><Key className="h-5 w-5"/> Metas de Locação</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rentals-annual-target">Anual</Label>
                  <Input id="rentals-annual-target" type="number" value={editableTargets.rentals.annual} onChange={(e) => setEditableTargets(t => ({...t, rentals: {...t.rentals, annual: Number(e.target.value)}}))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentals-semiannual-target">Semestral</Label>
                  <Input id="rentals-semiannual-target" type="number" value={editableTargets.rentals.semiannual} onChange={(e) => setEditableTargets(t => ({...t, rentals: {...t.rentals, semiannual: Number(e.target.value)}}))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentals-quarterly-target">Trimestral</Label>
                  <Input id="rentals-quarterly-target" type="number" value={editableTargets.rentals.quarterly} onChange={(e) => setEditableTargets(t => ({...t, rentals: {...t.rentals, quarterly: Number(e.target.value)}}))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave}>Salvar Metas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
