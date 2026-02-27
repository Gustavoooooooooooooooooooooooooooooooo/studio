"use client"

import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SaleRecord, brokers, origins } from "@/app/lib/mock-data";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface SalesMatrixProps {
  sales: SaleRecord[];
}

export function SalesMatrix({ sales }: SalesMatrixProps) {
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  // Matriz de Vendas por Canal
  const originMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    origins.forEach(o => matrix[o] = new Array(12).fill(0));

    sales.forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.origem]) {
        matrix[sale.origem][monthIndex] += 1;
      }
    });

    return matrix;
  }, [sales]);

  // Matriz de Quantidade por Corretor
  const brokerCountMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    brokers.forEach(b => matrix[b] = new Array(12).fill(0));

    sales.forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.corretor]) {
        matrix[sale.corretor][monthIndex] += 1;
      }
    });

    return matrix;
  }, [sales]);

  // Matriz de Valor por Corretor
  const brokerValueMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    brokers.forEach(b => matrix[b] = new Array(12).fill(0));

    sales.forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.corretor]) {
        matrix[sale.corretor][monthIndex] += sale.valor_fechado;
      }
    });

    return matrix;
  }, [sales]);

  const renderTable = (title: string, dataMatrix: Record<string, number[]>, isCurrency: boolean = false) => (
    <Card className="mb-8 border-none shadow-sm">
      <CardHeader className="bg-muted/30 pb-3">
        <CardTitle className="text-lg font-bold text-primary">{title}</CardTitle>
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
              <TableRow className="bg-muted/10 font-bold">
                <TableCell>Total Geral</TableCell>
                {months.map((_, i) => {
                  const monthTotal = Object.values(dataMatrix).reduce((acc, curr) => acc + curr[i], 0);
                  return (
                    <TableCell key={i} className="text-center text-xs">
                      {isCurrency ? formatCurrency(monthTotal) : monthTotal}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right text-sm">
                  {isCurrency 
                    ? formatCurrency(Object.values(dataMatrix).reduce((acc, curr) => acc + curr.reduce((a, b) => a + b, 0), 0))
                    : Object.values(dataMatrix).reduce((acc, curr) => acc + curr.reduce((a, b) => a + b, 0), 0)
                  }
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderTable("Total Vendas por Canal", originMatrix)}
      {renderTable("Total Vendas por Corretor (Qtd)", brokerCountMatrix)}
      {renderTable("Valor Total Vendido por Corretor", brokerValueMatrix, true)}
    </div>
  );
}
