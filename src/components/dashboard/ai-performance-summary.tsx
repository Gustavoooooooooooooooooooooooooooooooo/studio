"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, ArrowRightCircle } from "lucide-react";
import { generateSalesPerformanceSummary, SalesPerformanceSummaryOutput } from "@/ai/flows/ai-sales-performance-summary";
import { SaleRecord } from "@/app/lib/mock-data";

interface AIPerformanceSummaryProps {
  sales: SaleRecord[];
}

export function AIPerformanceSummary({ sales }: AIPerformanceSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SalesPerformanceSummaryOutput | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // Map mock data to Genkit input schema
      const result = await generateSalesPerformanceSummary({
        salesData: sales.map(s => ({
          id_imovel: s.id_imovel,
          data_entrada: s.data_entrada,
          data_venda: s.data_venda,
          origem: s.origem,
          corretor: s.corretor,
          valor_fechado: s.valor_fechado,
          tempo_de_venda_dias: Math.floor((new Date(s.data_venda).getTime() - new Date(s.data_entrada).getTime()) / (1000 * 3600 * 24))
        }))
      });
      setSummary(result);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-bold text-primary">Insights de IA</CardTitle>
        </div>
        {!summary && (
          <Button 
            onClick={handleGenerate} 
            disabled={loading}
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Gerar Análise"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando dados de vendas e tendências...</p>
          </div>
        )}

        {summary && !loading && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-primary mb-1 uppercase tracking-wider">Resumo Executivo</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{summary.summary}</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/50 p-3 rounded-lg border border-primary/10">
                <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                   <ArrowRightCircle className="h-4 w-4" /> Tendências
                </h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {summary.keyTrends.map((t, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white/50 p-3 rounded-lg border border-primary/10">
                <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                   <ArrowRightCircle className="h-4 w-4" /> Recomendações
                </h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {summary.strategicRecommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-accent shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-semibold text-primary">Top Performers:</span>
                <div className="flex gap-2">
                  {summary.topPerformers.map((p, i) => (
                    <span key={i} className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-medium">
                      {p}
                    </span>
                  ))}
                </div>
            </div>

            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSummary(null)} 
                className="text-xs text-primary/70 hover:text-primary px-0"
            >
                Redefinir análise
            </Button>
          </div>
        )}

        {!summary && !loading && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Obtenha uma análise detalhada baseada em inteligência artificial sobre o seu estoque e performance de vendas.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}