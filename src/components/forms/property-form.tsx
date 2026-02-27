
"use client"

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore, useUser, useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { toast } from "@/hooks/use-toast";
import { Loader2, Home, MapPin, DollarSign, User } from "lucide-react";
import { brokers } from "@/app/lib/mock-data";

const propertySchema = z.object({
  propertyCode: z.string().min(3, "Código obrigatório"),
  address: z.string().min(5, "Endereço obrigatório"),
  neighborhood: z.string().min(2, "Bairro obrigatório"),
  listingType: z.enum(["Venda", "Locação", "Venda e Locação"]),
  listingValue: z.string().transform((v) => Number(v)),
  brokerName: z.string().min(1, "Selecione o corretor"),
});

type PropertyFormData = z.infer<typeof propertySchema>;

export function PropertyForm() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
  });

  const onSubmit = async (data: PropertyFormData) => {
    if (!firestore) return;

    const colRef = collection(firestore, "properties");
    
    addDocumentNonBlocking(colRef, {
      ...data,
      captureDate: new Date().toISOString(),
      status: "Disponível",
      brokerId: user?.uid || "anonymous",
      createdAt: serverTimestamp(),
    });

    toast({
      title: "Imóvel Cadastrado!",
      description: `O imóvel ${data.propertyCode} foi adicionado com sucesso.`,
    });
    reset();
  };

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          Ficha de Captação
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código do Imóvel</Label>
              <Input placeholder="Ex: IM-1002" {...register("propertyCode")} />
              {errors.propertyCode && <p className="text-xs text-destructive">{errors.propertyCode.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tipo de Transação</Label>
              <Select onValueChange={(v) => setValue("listingType", v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Locação">Locação</SelectItem>
                  <SelectItem value="Venda e Locação">Venda e Locação</SelectItem>
                </SelectContent>
              </Select>
              {errors.listingType && <p className="text-xs text-destructive">{errors.listingType.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Endereço Completo</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Rua, Número, Complemento" {...register("address")} />
            </div>
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input placeholder="Ex: Moema" {...register("neighborhood")} />
              {errors.neighborhood && <p className="text-xs text-destructive">{errors.neighborhood.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Valor Anúncio (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="number" className="pl-9" placeholder="0.00" {...register("listingValue")} />
              </div>
              {errors.listingValue && <p className="text-xs text-destructive">{errors.listingValue.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Corretor Captador</Label>
            <Select onValueChange={(v) => setValue("brokerName", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o corretor" />
              </SelectTrigger>
              <SelectContent>
                {brokers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.brokerName && <p className="text-xs text-destructive">{errors.brokerName.message}</p>}
          </div>

          <Button type="submit" className="w-full mt-6" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Finalizar Cadastro"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
