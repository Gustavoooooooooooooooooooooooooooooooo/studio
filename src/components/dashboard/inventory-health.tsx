"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Home, Landmark, Calculator, Target } from "lucide-react";
import { MOCK_VGV_TOTAL, MOCK_PROPERTIES_IN_STOCK } from "@/app/lib/mock-data";

export function InventoryHealth() {
  const avgComm = 0.055; // 5.5% média
  const vgvEstoque = MOCK_VGV_TOTAL;
  const previsaoReceita = vgvEstoque * avgComm;
  
  const targetYear = 400; // Meta de 400 angariações no ano
  const currentAngariados = MOCK_PROPERTIES_IN_STOCK;
  const progress = (currentAngariados / targetYear) * 100;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
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
              <p className="text-[10px] text-muted-foreground uppercase font-bold">VGV em Carteira</p>
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
                <span className="font-bold">{formatCurrency(vgvEstoque / currentAngariados)}</span>
             </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-accent/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-accent">
            <Target className="h-4 w-4" /> Metas de Angariação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-accent">Meta Anual 2024</span>
              <span className="font-bold">{currentAngariados} / {targetYear}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-[10px] text-muted-foreground text-center">
               Você atingiu {progress.toFixed(1)}% da meta de angariações do ano.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-2 rounded-lg text-center border border-accent/10">
                <p className="text-[9px] text-muted-foreground uppercase">Meta Trimestral</p>
                <p className="text-sm font-bold">100 / 100</p>
                <Badge className="text-[8px] bg-emerald-500">Atingida</Badge>
            </div>
            <div className="bg-white p-2 rounded-lg text-center border border-accent/10">
                <p className="text-[9px] text-muted-foreground uppercase">Meta Semestral</p>
                <p className="text-sm font-bold">{currentAngariados} / 200</p>
                <Badge className="text-[8px] bg-amber-500">Em andamento</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
