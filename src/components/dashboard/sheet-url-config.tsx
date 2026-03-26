
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
      description: "Os links das planilhas e a logo foram salvos no navegador.",
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-lg flex items-center gap-2 text-primary">
          <Link className="h-5 w-5" />
          Configuração de Links e Logo
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground !mt-2">
          Insira os links para suas planilhas e faça o upload da logo da sua imobiliária.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="logo-upload" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Upload da Logo
          </Label>
          <Input 
            id="logo-upload"
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
           {logoUrl && (
            <div className="mt-4 p-2 border rounded-md bg-muted/50 flex items-center justify-center">
              <img src={logoUrl} alt="Pré-visualização da Logo" className="h-16 w-auto object-contain" />
            </div>
          )}
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
