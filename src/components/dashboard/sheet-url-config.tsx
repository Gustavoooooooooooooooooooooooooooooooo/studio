
"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link, Save, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SheetUrlConfigProps {
  urls: { inventory: string; leads: string; sales: string; rentals: string; logo: string; };
  onUrlsChange: (urls: { inventory: string; leads: string; sales: string; rentals: string; logo: string; }) => void;
}

export function SheetUrlConfig({ urls, onUrlsChange }: SheetUrlConfigProps) {
  const [inventoryUrl, setInventoryUrl] = useState(urls.inventory);
  const [leadsUrl, setLeadsUrl] = useState(urls.leads);
  const [salesUrl, setSalesUrl] = useState(urls.sales);
  const [rentalsUrl, setRentalsUrl] = useState(urls.rentals);
  const [logoUrl, setLogoUrl] = useState(urls.logo);
  const { toast } = useToast();

  useEffect(() => {
    setInventoryUrl(urls.inventory);
    setLeadsUrl(urls.leads);
    setSalesUrl(urls.sales);
    setRentalsUrl(urls.rentals);
    setLogoUrl(urls.logo);
  }, [urls]);

  const handleSave = () => {
    const newUrls = {
      inventory: inventoryUrl,
      leads: leadsUrl,
      sales: salesUrl,
      rentals: rentalsUrl,
      logo: logoUrl,
    };
    onUrlsChange(newUrls);
    toast({
      title: "Configurações Salvas",
      description: "Os links das planilhas e a URL da logo foram salvos no navegador.",
    });
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-lg flex items-center gap-2 text-primary">
          <Link className="h-5 w-5" />
          Configuração de Links e Logo
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground !mt-2">
          Insira os links para suas planilhas e a URL para a logo da sua imobiliária.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="logo-url" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            URL da Logo
          </Label>
          <Input 
            id="logo-url"
            placeholder="https://suaimobiliaria.com/logo.png" 
            value={logoUrl} 
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </div>
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
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
