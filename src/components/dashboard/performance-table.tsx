import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SaleRecord } from "@/app/lib/mock-data";

interface PerformanceTableProps {
  sales: SaleRecord[];
}

export function PerformanceTable({ sales }: PerformanceTableProps) {
  const brokerStats = sales.reduce((acc, sale) => {
    if (!acc[sale.corretor]) {
      acc[sale.corretor] = { count: 0, total: 0 };
    }
    acc[sale.corretor].count += 1;
    acc[sale.corretor].total += sale.valor_fechado;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  const sortedBrokers = Object.entries(brokerStats).sort((a, b) => b[1].total - a[1].total);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="shadow-sm border-none">
      <CardHeader>
        <CardTitle className="text-lg font-semibold font-headline">Ranking de Corretores</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Corretor</TableHead>
              <TableHead className="text-center">Vendas</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="text-right">Ticket Médio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBrokers.map(([name, stats]) => (
              <TableRow key={name}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-semibold">
                    {stats.count}
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(stats.total)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(stats.total / stats.count)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}