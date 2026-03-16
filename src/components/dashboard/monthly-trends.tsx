"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface MonthlyTrendsProps {
  sales: any[];
  properties: any[];
}

// This robust date parser is now defined outside the component to be reusable
// and to avoid being redeclared on every render.
const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) {
        if (isNaN(d.getTime())) return null;
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }

    const strVal = String(d).trim();
    if (!strVal || ["n/a", "undefined", "null", ""].includes(strVal.toLowerCase())) return null;

    // Matches DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
    const dmyMatch = strVal.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1;
        let year = parseInt(dmyMatch[3], 10);
        if (year < 100) year += 2000;
        if (day > 0 && day <= 31 && month >= 0 && month < 12) {
            const date = new Date(Date.UTC(year, month, day));
            if (!isNaN(date.getTime())) return date;
        }
    }

    // Matches YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
    const isoMatch = strVal.match(/^(\d{4})[.\/-](\d{2})[.\/-](\d{2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        if (day > 0 && day <= 31 && month >= 0 && month < 12) {
            const date = new Date(Date.UTC(year, month, day));
            if (!isNaN(date.getTime())) return date;
        }
    }
    
    // Handles Excel's integer date format
    if (/^\d{5}$/.test(strVal)) {
        const num = Number(strVal);
        if (!isNaN(num) && num > 30000 && num < 70000) {
            const excelEpoch = Date.UTC(1899, 11, 30);
            const date = new Date(excelEpoch + num * 86400000);
            if (!isNaN(date.getTime())) return date;
        }
    }

    // Fallback for other valid date strings that new Date() can parse
    const nativeDate = new Date(strVal);
    if (!isNaN(nativeDate.getTime())) {
        const utcDate = new Date(Date.UTC(nativeDate.getFullYear(), nativeDate.getMonth(), nativeDate.getDate()));
        if (!isNaN(utcDate.getTime())) return utcDate;
    }

    return null;
};

export function MonthlyTrends({ sales, properties }: MonthlyTrendsProps) {
  const data = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyData: Record<string, any> = {};
    
    monthsNames.forEach((name, i) => {
      const key = `${currentYear}-${String(i+1).padStart(2, '0')}`;
      monthlyData[key] = { month: name, vendas: 0, locacoes: 0, angariados: 0 };
    });

    const normalize = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    sales.forEach(sale => {
      const date = parseDate(sale.saleDate);
      if (date && date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          const tipo = normalize(sale.tipo || '');
          if (tipo.includes("venda")) {
            monthlyData[key].vendas += 1;
          } else if (tipo.includes("loca") || tipo.includes("aluguel")) {
            monthlyData[key].locacoes += 1;
          }
        }
      }
    });

    properties.forEach(prop => {
      const date = parseDate(prop.captureDate);
      if (date && date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) monthlyData[key].angariados += 1;
      }
    });

    return Object.values(monthlyData);
  }, [sales, properties]);

  const config = {
    vendas: { label: "Vendas", color: "hsl(var(--primary))" },
    locacoes: { label: "Locações", color: "hsl(var(--accent))" },
    angariados: { label: "Angariados", color: "#fbbf24" },
  };

  return (
    <Card className="shadow-sm border-none bg-white overflow-hidden">
      <CardHeader className="bg-muted/5 border-b">
        <CardTitle className="text-lg font-bold">Tendências Mensais ({new Date().getFullYear()})</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={config} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend verticalAlign="top" height={36}/>
              <Line type="monotone" dataKey="vendas" stroke="var(--color-vendas)" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="locacoes" stroke="var(--color-locacoes)" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="angariados" stroke="var(--color-angariados)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
