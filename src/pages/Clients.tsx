import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { ClientForm } from "@/components/clients/ClientForm";
import { Tables } from "@/integrations/supabase/types";

const Clients = () => {
  const [clients, setClients] = useState<Tables<"clients">[]>([]);
  const [filteredClients, setFilteredClients] = useState<Tables<"clients">[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Tables<"clients"> | null>(null);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredClients(clients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = clients.filter((client) =>
        client.full_name.toLowerCase().includes(query) ||
        (client.company_name && client.company_name.toLowerCase().includes(query)) ||
        (client.email && client.email.toLowerCase().includes(query)) ||
        (client.phone && client.phone.includes(query)) ||
        (client.mobile && client.mobile.includes(query))
      );
      setFilteredClients(filtered);
    }
  }, [searchQuery, clients]);

  const handleAddClient = () => {
    setSelectedClient(null);
    setDialogOpen(true);
  };

  const handleEditClient = (client: Tables<"clients">) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setSelectedClient(null);
    loadClients();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground">Rubrica Clienti</h1>
            <p className="text-muted-foreground mt-1">
              Gestisci l'anagrafica completa dei tuoi clienti
            </p>
          </div>
          <Button onClick={handleAddClient} className="h-auto min-h-10 w-full whitespace-normal text-center md:w-auto">
            <UserPlus className="mr-2 h-4 w-4 shrink-0" />
            <span>Aggiungi Cliente</span>
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, azienda, email o telefono..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <ClientsTable
          clients={filteredClients}
          loading={loading}
          onClientUpdated={loadClients}
          onClientEdit={handleEditClient}
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle>
                {selectedClient ? "Modifica Cliente" : "Aggiungi Nuovo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <ClientForm
              client={selectedClient}
              onSuccess={handleSuccess}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Clients;
