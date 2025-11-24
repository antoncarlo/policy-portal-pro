import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Phone, Building2, MapPin, FileText, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm } from "@/components/clients/ClientForm";

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [practices, setPractices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const loadClientData = async () => {
    setLoading(true);
    try {
      // Load client details
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Load associated practices
      const { data: practicesData, error: practicesError } = await supabase
        .from("practices")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      if (practicesError) throw practicesError;
      setPractices(practicesData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
      navigate("/clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadClientData();
    }
  }, [id]);

  if (loading || !client) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{client.full_name}</h1>
              {client.company_name && (
                <p className="text-muted-foreground mt-1">{client.company_name}</p>
              )}
            </div>
          </div>
          <Button onClick={() => setEditDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifica
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Information */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Informazioni Cliente</h2>
            <div className="space-y-4">
              {/* Contact Information */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Contatti</h3>
                <div className="space-y-2">
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${client.email}`} className="text-sm hover:underline">
                        {client.email}
                      </a>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${client.phone}`} className="text-sm hover:underline">
                        {client.phone}
                      </a>
                    </div>
                  )}
                  {client.mobile && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${client.mobile}`} className="text-sm hover:underline">
                        {client.mobile} (Cellulare)
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Company Information */}
              {(client.company_name || client.vat_number || client.tax_code) && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Informazioni Aziendali
                    </h3>
                    <div className="space-y-2">
                      {client.company_name && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{client.company_name}</span>
                        </div>
                      )}
                      {client.vat_number && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">P.IVA:</span> {client.vat_number}
                        </div>
                      )}
                      {client.tax_code && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">C.F.:</span> {client.tax_code}
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Address */}
              {(client.address_street || client.address_city) && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Indirizzo</h3>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm">
                        {client.address_street && <div>{client.address_street}</div>}
                        {(client.address_city || client.address_postal_code) && (
                          <div>
                            {client.address_postal_code} {client.address_city}{" "}
                            {client.address_province && `(${client.address_province})`}
                          </div>
                        )}
                        {client.address_country && <div>{client.address_country}</div>}
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Notes */}
              {client.notes && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Note</h3>
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Statistics */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Statistiche</h2>
            <div className="space-y-4">
              <div>
                <div className="text-2xl font-bold">{practices.length}</div>
                <div className="text-sm text-muted-foreground">Pratiche Totali</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Cliente dal</div>
                <div className="font-medium">
                  {new Date(client.created_at).toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Associated Practices */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Pratiche Associate</h2>
            <Badge variant="secondary">{practices.length}</Badge>
          </div>
          {practices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nessuna pratica associata a questo cliente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {practices.map((practice) => (
                <div
                  key={practice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => navigate(`/practices/${practice.id}`)}
                >
                  <div>
                    <div className="font-medium">{practice.practice_number}</div>
                    <div className="text-sm text-muted-foreground">
                      {practice.practice_type} - {practice.policy_number || "N/A"}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge>{practice.status}</Badge>
                    <div className="text-sm text-muted-foreground mt-1">
                      {new Date(practice.created_at).toLocaleDateString("it-IT")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            client={client}
            onSuccess={() => {
              setEditDialogOpen(false);
              loadClientData();
            }}
            onCancel={() => setEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ClientDetail;
