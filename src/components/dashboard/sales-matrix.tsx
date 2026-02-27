
"use client"

import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import React from 'react';

interface SalesMatrixProps {
  sales: any[];
}

export function SalesMatrix({ sales }: SalesMatrixProps) {
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  // Identifica corretores e canais reais presentes nos dados
  const realBrokers = useMemo(() => Array.from(new Set(sales.map(s => s.corretor))).filter(Boolean).sort(), [sales]);
  const realOrigins = useMemo(() => Array.from(new Set(sales.map(s => s.origem))).filter(Boolean).sort(), [sales]);

  // Matriz de Angariação (Captura de Imóveis)
  const angariacaoMatrix = useMemo(() => {
    const matrix: Record<string, { venda: number[], locacao: number[] }> = {};
    realBrokers.forEach(b => {
      matrix[b] = { venda: new Array(12).fill(0), locacao: new Array(12).fill(0) };
    });

    sales.forEach(sale => {
      const entryDate = new Date(sale.data_entrada);
      if (!isNaN(entryDate.getTime())) {
        const monthIndex = entryDate.getMonth();
        if (matrix[sale.corretor]) {
          if (sale.tipo === 'Venda') matrix[sale.corretor].venda[monthIndex] += 1;
          else matrix[sale.corretor].locacao[monthIndex] += 1;
        }
      }
    });
    return matrix;
  }, [sales, realBrokers]);

  // Matriz de Vendas por Canal
  const originVendaMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    realOrigins.forEach(o => matrix[o] = new Array(12).fill(0));
    sales.filter(s => s.tipo === 'Venda').forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.origem]) matrix[sale.origem][monthIndex] += 1;
    });
    return matrix;
  }, [sales, realOrigins]);

  // Matriz de Valor por Corretor (VGV)
  const brokerValueMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    realBrokers.forEach(b => matrix[b] = new Array(12).fill(0));
    sales.filter(s => s.tipo === 'Venda').forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.corretor]) matrix[sale.corretor][monthIndex] += (Number(sale.valor_fechado) || 0);
    });
    return matrix;
  }, [sales, realBrokers]);

  if (realBrokers.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground border rounded-lg bg-muted/5">
        Aguardando sincronização de dados reais...
      </div>
    );
  }

  const renderTable = (title: string, dataMatrix: Record<string, number[]>, colorClass: string, isCurrency: boolean = false) => (
    <Card className="mb-8 border-none shadow-sm overflow-hidden">
      <CardHeader className={`${colorClass} pb-3`}>
        <CardTitle className="text-lg font-bold text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="min-w-[150px] font-bold">Categoria</TableHead>
                {months.map(m => (
                  <TableHead key={m} className="text-center text-xs px-2">{m}</TableHead>
                ))}
                <TableHead className="text-right font-bold bg-muted/20">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(dataMatrix).map(([name, row]) => {
                const total = row.reduce((a, b) => a + b, 0);
                return (
                  <TableRow key={name} className="hover:bg-muted/5">
                    <TableCell className="font-medium text-sm">{name}</TableCell>
                    {row.map((val, i) => (
                      <TableCell key={i} className={`text-center text-xs ${val === 0 ? 'text-muted-foreground/30' : 'font-medium'}`}>
                        {isCurrency ? (val === 0 ? 'R$ 0' : formatCurrency(val)) : val}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold text-sm bg-muted/5">
                      {isCurrency ? formatCurrency(total) : total}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderTable("Total VGV por Corretor", brokerValueMatrix, "bg-primary", true)}
      {renderTable("Vendas por Canal", originVendaMatrix, "bg-emerald-600")}
    </div>
  );
}
