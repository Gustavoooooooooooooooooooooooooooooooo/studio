
"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SheetUrlConfigProps {
  urls: { inventory: string; leads: string; sales: string; rentals: string; };
  onUrlsChange: (urls: { inventory: string; leads: string; sales: string; rentals: string; }) => void;
}

export function SheetUrlConfig({ urls, onUrlsChange }: SheetUrlConfigProps) {
  const [inventoryUrl, setInventoryUrl] = useState(urls.inventory);
  const [leadsUrl, setLeadsUrl] = useState(urls.leads);
  const [salesUrl, setSalesUrl] = useState(urls.sales);
  const [rentalsUrl, setRentalsUrl] = useState(urls.rentals);
  const { toast } = useToast();

  useEffect(() => {
    setInventoryUrl(urls.inventory);
    setLeadsUrl(urls.leads);
    setSalesUrl(urls.sales);
    setRentalsUrl(urls.rentals);
  }, [urls]);

  const handleSave = () => {
    const newUrls = {
      inventory: inventoryUrl,
      leads: leadsUrl,
      sales: salesUrl,
      rentals: rentalsUrl,
    };
    onUrlsChange(newUrls);
    toast({
      title: "URLs Salvas",
      description: "Os links das planilhas foram salvos no navegador.",
    });
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-lg flex items-center gap-2 text-primary">
          <Link className="h-5 w-5" />
          Configuração das Planilhas (Google Sheets)
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground !mt-2">
          Insira os links de exportação CSV para cada uma das suas planilhas. Lembre-se de publicá-las na web.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="inventory-url">URL da Planilha de Cadastro (Estoque)</Label>
          <Input 
            id="inventory-url"
            placeholder="Cole o link CSV publicado do Google Sheets..." 
            value={inventoryUrl} 
            onChange={(e) => setInventoryUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="leads-url">URL da Planilha de Leads</Label>
          <Input 
            id="leads-url"
            placeholder="Cole o link CSV publicado do Google Sheets..." 
            value={leadsUrl} 
            onChange={(e) => setLeadsUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sales-url">URL da Planilha de Conclusão (Vendas)</Label>
          <Input 
            id="sales-url"
            placeholder="Cole o link CSV publicado do Google Sheets..." 
            value={salesUrl} 
            onChange={(e) => setSalesUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rentals-url">URL da Planilha de Conclusão (Locação)</Label>
          <Input 
            id="rentals-url"
            placeholder="Cole o link CSV publicado do Google Sheets..." 
            value={rentalsUrl} 
            onChange={(e) => setRentalsUrl(e.target.value)}
          />
        </div>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Salvar Links
        </Button>
      </CardContent>
    </Card>
  );
}
