
"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserCheck, AlertCircle, PlusCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BrokerSettingsProps {
    brokers: string[];
    onAddBroker: (name: string) => void;
}

export function BrokerSettings({ brokers, onAddBroker }: BrokerSettingsProps) {
  const [newBrokerName, setNewBrokerName] = useState("");

  const handleAdd = () => {
    if (newBrokerName.trim()) {
        onAddBroker(newBrokerName.trim());
        setNewBrokerName("");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-none shadow-sm">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            Corretores
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground !mt-2">
            Adicione corretores manualmente ou veja a lista de corretores únicos encontrados automaticamente nas suas planilhas.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Input 
              value={newBrokerName}
              onChange={(e) => setNewBrokerName(e.target.value)}
              placeholder="Nome do novo corretor"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Adicionar Corretor
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[400px]">
                <Table>
                <TableHeader className="bg-muted/30 sticky top-0">
                    <TableRow>
                    <TableHead>Corretor Identificado</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {brokers && brokers.length > 0 ? (
                    brokers.map((broker) => (
                        <TableRow key={broker}>
                        <TableCell className="font-semibold flex items-center gap-2 text-sm">
                            <UserCheck className="h-4 w-4 text-emerald-500" />
                            {broker}
                        </TableCell>
                        <TableCell className="text-center">
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">
                            Ativo
                            </span>
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="h-8 w-8 opacity-20" />
                            <p className="text-xs">Nenhum corretor encontrado ou adicionado.</p>
                        </div>
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
