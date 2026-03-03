
"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Trash2, Plus, Users, Loader2, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BrokerSettings() {
  const [newBrokerName, setNewBrokerName] = useState("");
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const brokersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "brokers"), orderBy("name", "asc"));
  }, [firestore]);

  const { data: brokersList, isLoading } = useCollection(brokersQuery);

  const handleAddBroker = () => {
    if (!newBrokerName.trim() || !firestore) return;

    const brokerName = newBrokerName.trim();
    // Verifica se já existe (normalizado)
    const exists = brokersList?.some(b => b.name.toLowerCase() === brokerName.toLowerCase());
    
    if (exists) {
      toast({
        variant: "destructive",
        title: "Corretor já cadastrado",
        description: "Este nome já consta na sua lista de configurações."
      });
      return;
    }

    const brokersRef = collection(firestore, "brokers");
    addDocumentNonBlocking(brokersRef, {
      name: brokerName,
      active: true,
      createdAt: new Date().toISOString()
    });

    setNewBrokerName("");
    toast({
      title: "Corretor Adicionado",
      description: `${brokerName} agora faz parte da lista oficial.`
    });
  };

  const handleDeleteBroker = (id: string, name: string) => {
    if (!firestore) return;
    const brokerRef = doc(firestore, "brokers", id);
    deleteDocumentNonBlocking(brokerRef);
    toast({
      title: "Corretor Removido",
      description: `${name} foi removido das configurações.`
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-none shadow-sm">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            Configuração de Corretores Oficiais
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cadastre aqui os nomes dos corretores que você deseja que apareçam no Dashboard. 
            Isso ajudará a padronizar os nomes vindos das planilhas.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-8">
            <div className="relative flex-1">
              <Input 
                placeholder="Nome do corretor (Ex: Mila)" 
                value={newBrokerName} 
                onChange={(e) => setNewBrokerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddBroker()}
              />
            </div>
            <Button onClick={handleAddBroker} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Corretor Cadastrado</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : brokersList && brokersList.length > 0 ? (
                  brokersList.map((broker) => (
                    <TableRow key={broker.id}>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                        {broker.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">
                          Ativo
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteBroker(broker.id, broker.name)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                      Nenhum corretor configurado. Adicione o primeiro acima!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-amber-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="p-2 bg-amber-100 rounded-full h-fit">
              <Plus className="h-4 w-4 text-amber-600" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-800">Dica de Padronização</h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                Ao cadastrar os corretores aqui, o app passará a priorizar estes nomes. 
                Certifique-se de usar o nome exatamente como você deseja que apareça nos relatórios finais.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
