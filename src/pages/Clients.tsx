import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus } from "lucide-react";

const Clients = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clienti</h1>
            <p className="text-muted-foreground mt-1">
              Gestisci i dati dei tuoi clienti
            </p>
          </div>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Aggiungi Cliente
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca clienti..." className="pl-10" />
        </div>

        <Card className="p-6">
          <div className="text-center py-12 text-muted-foreground">
            Funzionalità clienti in sviluppo
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Clients;
