
"use client"

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebase, useUser } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { toast } from "@/hooks/use-toast";
import { Loader2, BadgeCheck, User, Search, TrendingDown, Target } from "lucide-react";
import { brokers, origins } from "@/app/lib/mock-data";

const saleSchema = z.object({
  propertyId: z.string().min(1, "ID do imóvel obrigatório"),
  clientName: z.string().min(3, "Nome do cliente obrigatório"),
  closedValue: z.string().transform(v => Number(v)),
  originChannel: z.string().min(1, "Canal de origem obrigatório"),
  sellingBrokerId: z.string().min(1, "Corretor obrigatório"),
  saleDate: z.string().min(1, "Data da venda obrigatória"),
});

type SaleFormData = z.infer<typeof saleSchema>;

export function SaleForm() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
  });

  const onSubmit = async (data: SaleFormData) => {
    if (!firestore) return;

    const colRef = collection(firestore, "vendas_imoveis");
    
    addDocumentNonBlocking(colRef, {
      ...data,
      status: "Vendido",
      createdAt: serverTimestamp(),
      brokerUid: user?.uid || "anonymous"
    });

    toast({
      title: "Venda Concluída!",
      description: `Fechamento registrado para o cliente ${data.clientName}.`,
    });
    reset();
  };

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="bg-accent/5 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-accent" />
          Dados do Fechamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ID do Imóvel</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Ex: IM-1002" {...register("propertyId")} />
              </div>
              {errors.propertyId && <p className="text-xs text-destructive">{errors.propertyId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Data da Venda</Label>
              <Input type="date" {...register("saleDate")} />
              {errors.saleDate && <p className="text-xs text-destructive">{errors.saleDate.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome do Cliente (Comprador/Locatário)</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nome Completo" {...register("clientName")} />
            </div>
            {errors.clientName && <p className="text-xs text-destructive">{errors.clientName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor do Fechamento (R$)</Label>
              <div className="relative">
                <TrendingDown className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="number" className="pl-9" placeholder="0.00" {...register("closedValue")} />
              </div>
              {errors.closedValue && <p className="text-xs text-destructive">{errors.closedValue.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Origem do Lead</Label>
              <Select onValueChange={(v) => setValue("originChannel", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.originChannel && <p className="text-xs text-destructive">{errors.originChannel.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Corretor Responsável</Label>
            <Select onValueChange={(v) => setValue("sellingBrokerId", v)}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Selecione o corretor" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {brokers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.sellingBrokerId && <p className="text-xs text-destructive">{errors.sellingBrokerId.message}</p>}
          </div>

          <Button type="submit" className="w-full mt-6 bg-accent hover:bg-accent/90 text-white" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirmar Fechamento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
