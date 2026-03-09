
"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserCheck, AlertCircle, PlusCircle, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BrokerSettingsProps {
    brokers: string[];
    onAddBroker: (name: string) => void;
    onDeleteBroker: (name: string) => void;
}

export function BrokerSettings({ brokers, onAddBroker, onDeleteBroker }: BrokerSettingsProps) {
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
            Gerenciamento de Corretores
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground !mt-2">
            Esta é a lista definitiva de corretores que aparecerão no dashboard. Somente os corretores adicionados aqui serão considerados nas análises.
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
                    <TableHead>Corretor</TableHead>
                    <TableHead className="text-right w-[100px]">Ações</TableHead>
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
                          <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação removerá permanentemente o corretor <span className="font-bold">{broker}</span> da sua lista de análise.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteBroker(broker)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                          </TableCell>
                        </TableRow>
                      )
                    )
                    ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="h-8 w-8 opacity-20" />
                            <p className="font-medium">Nenhum corretor cadastrado.</p>
                            <p className="text-xs">Adicione um corretor para começar a análise.</p>
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
