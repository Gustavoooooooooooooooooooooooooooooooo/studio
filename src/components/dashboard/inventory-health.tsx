
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Landmark, Target, Edit } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InventoryHealthProps {
  properties: any[];
  targets: { annual: number; quarterly: number; semiannual: number; };
  onTargetsChange: (newTargets: { annual: number; quarterly: number; semiannual: number; }) => void;
}

export function InventoryHealth({ properties, targets, onTargetsChange }: InventoryHealthProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editableTargets, setEditableTargets] = useState(targets);

  useEffect(() => {
    setEditableTargets(targets);
  }, [targets, isDialogOpen]);

  const stats = useMemo(() => {
    const count = properties.length;
    const vgv = properties.reduce((acc, p) => acc + (Number(p.saleValue) || 0), 0);
    return { count, vgv };
  }, [properties]);

  const avgComm = 0.055; 
  const vgvEstoque = stats.vgv;
  const previsaoReceita = vgvEstoque * avgComm;
  
  const currentAngariados = stats.count;
  const progress = targets.annual > 0 ? Math.min(100, (currentAngariados / targets.annual) * 100) : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const handleSave = () => {
    onTargetsChange(editableTargets);
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
                <span className="font-bold">{currentAngariados} unidades</span>
             </div>
             <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Ticket Médio Estoque:</span>
                <span className="font-bold">{formatCurrency(currentAngariados > 0 ? vgvEstoque / currentAngariados : 0)}</span>
             </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
            <Card className="border-none shadow-sm bg-accent/5 cursor-pointer hover:bg-accent/10 transition-colors group">
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-accent">
                      <Target className="h-4 w-4" /> Metas de Angariação
                  </CardTitle>
                  <div className="absolute top-3 right-3 p-1.5 rounded-full bg-white/60 text-accent/50 group-hover:bg-white group-hover:text-accent transition-colors">
                      <Edit className="h-3 w-3" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                    <span className="font-semibold text-accent">Meta Anual Real</span>
                    <span className="font-bold">{currentAngariados} / {targets.annual}</span>
                    </div>
                    <Progress value={progress} className="h-2 [&>div]:bg-accent" />
                    <p className="text-[10px] text-muted-foreground text-center">
                    Você atingiu {progress.toFixed(1)}% da meta de angariações baseada nos dados reais.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-2 rounded-lg text-center border border-accent/10">
                        <p className="text-[9px] text-muted-foreground uppercase">Meta Trimestral</p>
                        <p className="text-sm font-bold">{currentAngariados} / {targets.quarterly}</p>
                        <Badge className={`text-[8px] ${currentAngariados >= targets.quarterly ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                        {currentAngariados >= targets.quarterly ? 'Atingida' : 'Em andamento'}
                        </Badge>
                    </div>
                    <div className="bg-white p-2 rounded-lg text-center border border-accent/10">
                        <p className="text-[9px] text-muted-foreground uppercase">Meta Semestral</p>
                        <p className="text-sm font-bold">{currentAngariados} / {targets.semiannual}</p>
                        <Badge className={`text-[8px] ${currentAngariados >= targets.semiannual ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                        {currentAngariados >= targets.semiannual ? 'Atingida' : 'Em andamento'}
                        </Badge>
                    </div>
                </div>
                </CardContent>
            </Card>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Editar Metas de Angariação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="annual-target">Meta Anual</Label>
                    <Input 
                        id="annual-target" 
                        type="number" 
                        value={editableTargets.annual}
                        onChange={(e) => setEditableTargets(t => ({...t, annual: Number(e.target.value)}))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="semiannual-target">Meta Semestral</Label>
                    <Input 
                        id="semiannual-target" 
                        type="number" 
                        value={editableTargets.semiannual}
                        onChange={(e) => setEditableTargets(t => ({...t, semiannual: Number(e.target.value)}))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="quarterly-target">Meta Trimestral</Label>
                    <Input 
                        id="quarterly-target" 
                        type="number" 
                        value={editableTargets.quarterly}
                        onChange={(e) => setEditableTargets(t => ({...t, quarterly: Number(e.target.value)}))}
                    />
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
