"use client"

import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SaleRecord, brokers, origins } from "@/app/lib/mock-data";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import React from 'react';

interface SalesMatrixProps {
  sales: SaleRecord[];
}

export function SalesMatrix({ sales }: SalesMatrixProps) {
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  // Matriz de Angariação (Captura de Imóveis) - Venda e Locação
  const angariacaoMatrix = useMemo(() => {
    const matrix: Record<string, { venda: number[], locacao: number[] }> = {};
    brokers.forEach(b => {
      matrix[b] = {
        venda: new Array(12).fill(0),
        locacao: new Array(12).fill(0)
      };
    });

    sales.forEach(sale => {
      const entryDate = new Date(sale.data_entrada);
      if (entryDate.getFullYear() === 2024) {
        const monthIndex = entryDate.getMonth();
        if (matrix[sale.corretor]) {
          if (sale.tipo === 'Venda') {
            matrix[sale.corretor].venda[monthIndex] += 1;
          } else {
            matrix[sale.corretor].locacao[monthIndex] += 1;
          }
        }
      }
    });

    return matrix;
  }, [sales]);

  // Matriz de Vendas por Canal
  const originVendaMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    origins.forEach(o => matrix[o] = new Array(12).fill(0));
    sales.filter(s => s.tipo === 'Venda').forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.origem]) matrix[sale.origem][monthIndex] += 1;
    });
    return matrix;
  }, [sales]);

  // Matriz de Locações por Canal
  const originLocacaoMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    origins.forEach(o => matrix[o] = new Array(12).fill(0));
    sales.filter(s => s.tipo === 'Aluguel').forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.origem]) matrix[sale.origem][monthIndex] += 1;
    });
    return matrix;
  }, [sales]);

  // Matriz de Vendas por Corretor (Qtd)
  const brokerVendaCountMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    brokers.forEach(b => matrix[b] = new Array(12).fill(0));
    sales.filter(s => s.tipo === 'Venda').forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.corretor]) matrix[sale.corretor][monthIndex] += 1;
    });
    return matrix;
  }, [sales]);

  // Matriz de Locações por Corretor (Qtd)
  const brokerLocacaoCountMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    brokers.forEach(b => matrix[b] = new Array(12).fill(0));
    sales.filter(s => s.tipo === 'Aluguel').forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.corretor]) matrix[sale.corretor][monthIndex] += 1;
    });
    return matrix;
  }, [sales]);

  // Matriz de Valor por Corretor (Venda - VGV)
  const brokerValueMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    brokers.forEach(b => matrix[b] = new Array(12).fill(0));
    sales.filter(s => s.tipo === 'Venda').forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.corretor]) matrix[sale.corretor][monthIndex] += sale.valor_fechado;
    });
    return matrix;
  }, [sales]);

  // Matriz de Valor por Corretor (Locação)
  const brokerRentalValueMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    brokers.forEach(b => matrix[b] = new Array(12).fill(0));
    sales.filter(s => s.tipo === 'Aluguel').forEach(sale => {
      const monthIndex = new Date(sale.data_venda).getMonth();
      if (matrix[sale.corretor]) matrix[sale.corretor][monthIndex] += sale.valor_fechado;
    });
    return matrix;
  }, [sales]);

  const renderAngariacaoTable = () => (
    <Card className="mb-8 border-none shadow-sm overflow-hidden">
      <CardHeader className="bg-emerald-600 pb-3">
        <CardTitle className="text-lg font-bold text-white">Angariação (Entradas na Carteira)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead rowSpan={2} className="min-w-[150px] font-bold border-r">Corretor</TableHead>
                {months.map(m => (
                  <TableHead key={m} colSpan={2} className="text-center border-r font-bold text-xs">
                    {m}
                  </TableHead>
                ))}
                <TableHead colSpan={2} className="text-center font-bold bg-muted/20">Total Anual</TableHead>
              </TableRow>
              <TableRow>
                {months.map(m => (
                  <React.Fragment key={`${m}-sub`}>
                    <TableHead className="text-center text-[10px] p-1 border-r">VENDA</TableHead>
                    <TableHead className="text-center text-[10px] p-1 border-r">LOCAÇÃO</TableHead>
                  </React.Fragment>
                ))}
                <TableHead className="text-center text-[10px] p-1 bg-muted/20">VENDA</TableHead>
                <TableHead className="text-center text-[10px] p-1 bg-muted/20">LOCAÇÃO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(angariacaoMatrix).map(([name, data]) => {
                const totalVenda = data.venda.reduce((a, b) => a + b, 0);
                const totalLocacao = data.locacao.reduce((a, b) => a + b, 0);
                return (
                  <TableRow key={name} className="hover:bg-muted/5">
                    <TableCell className="font-bold text-xs uppercase border-r">{name}</TableCell>
                    {data.venda.map((_, i) => (
                      <React.Fragment key={i}>
                        <TableCell className={`text-center text-xs border-r ${data.venda[i] === 0 ? 'text-muted-foreground/30' : 'font-medium'}`}>
                          {data.venda[i]}
                        </TableCell>
                        <TableCell className={`text-center text-xs border-r ${data.locacao[i] === 0 ? 'text-muted-foreground/30' : 'font-medium'}`}>
                          {data.locacao[i]}
                        </TableCell>
                      </React.Fragment>
                    ))}
                    <TableCell className="text-center font-bold text-xs bg-muted/5">{totalVenda}</TableCell>
                    <TableCell className="text-center font-bold text-xs bg-muted/5">{totalLocacao}</TableCell>
                  </TableRow>
                );
              })}
              
              <TableRow className="bg-emerald-50 font-bold border-t-2">
                <TableCell className="border-r">Angariações</TableCell>
                {months.map((_, i) => {
                  const monthVenda = Object.values(angariacaoMatrix).reduce((acc, curr) => acc + curr.venda[i], 0);
                  const monthLocacao = Object.values(angariacaoMatrix).reduce((acc, curr) => acc + curr.locacao[i], 0);
                  return (
                    <React.Fragment key={i}>
                      <TableCell className="text-center text-xs border-r">{monthVenda}</TableCell>
                      <TableCell className="text-center text-xs border-r">{monthLocacao}</TableCell>
                    </React.Fragment>
                  );
                })}
                <TableCell className="text-center text-xs">
                  {Object.values(angariacaoMatrix).reduce((acc, curr) => acc + curr.venda.reduce((a, b) => a + b, 0), 0)}
                </TableCell>
                <TableCell className="text-center text-xs">
                  {Object.values(angariacaoMatrix).reduce((acc, curr) => acc + curr.locacao.reduce((a, b) => a + b, 0), 0)}
                </TableCell>
              </TableRow>

              <TableRow className="bg-muted/10 font-bold">
                <TableCell className="border-r">Total/Mês</TableCell>
                {months.map((_, i) => {
                  const total = Object.values(angariacaoMatrix).reduce((acc, curr) => acc + curr.venda[i] + curr.locacao[i], 0);
                  return (
                    <TableCell key={i} colSpan={2} className="text-center text-xs border-r">
                      {total}
                    </TableCell>
                  );
                })}
                <TableCell colSpan={2} className="text-center text-sm bg-muted/20">
                  {Object.values(angariacaoMatrix).reduce((acc, curr) => 
                    acc + curr.venda.reduce((a, b) => a + b, 0) + curr.locacao.reduce((a, b) => a + b, 0)
                  , 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );

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
      {renderAngariacaoTable()}
      <div className="grid lg:grid-cols-2 gap-6">
        {renderTable("Total Vendas por Canal", originVendaMatrix, "bg-primary")}
        {renderTable("Total Locações por Canal", originLocacaoMatrix, "bg-accent")}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {renderTable("Total Vendas por Corretor (Qtd)", brokerVendaCountMatrix, "bg-primary/80")}
        {renderTable("Total Locações por Corretor (Qtd)", brokerLocacaoCountMatrix, "bg-accent/80")}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {renderTable("Valor Total Vendido por Corretor (VGV)", brokerValueMatrix, "bg-indigo-600", true)}
        {renderTable("Valor Total Locado por Corretor", brokerRentalValueMatrix, "bg-rose-600", true)}
      </div>
    </div>
  );
}
