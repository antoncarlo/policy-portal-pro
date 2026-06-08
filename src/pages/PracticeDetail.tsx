import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, User, Phone, Mail, FileText, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PracticeTimeline } from "@/components/practice/PracticeTimeline";
import { PracticeDocuments } from "@/components/practice/PracticeDocuments";
import { PracticeStatusForm } from "@/components/practice/PracticeStatusForm";
import { PracticeNotes } from "@/components/practice/PracticeNotes";


type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";
type PracticeType = "fidejussioni" | "car" | "postuma_decennale" | "all_risk" | "responsabilita_civile" | "pet" | "fotovoltaico" | "catastrofali" | "azienda" | "casa" | "risparmio" | "salute" | "auto" | "vita" | "responsabilita" | "vies" | "altro";

interface Practice {
  id: string;
  practice_number: string;
  practice_type: PracticeType;
  status: PracticeStatus;
  client_name: string;
  client_phone: string;
  client_email: string;
  policy_number: string | null;
  beneficiary: string | null;
  owner_tax_code: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  premium_gross: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const VIES_GUARANTEE_OBJECT = "POLIZZA FIDEIUSSORIA AI SENSI DELL’ART. 35, COMMA 7-QUATER, DEL DPR 633/1972.";
const VIES_DEFAULT_GUARANTEED_AMOUNT = 50000;

const formatCurrency = (value: number | null | undefined) =>
  (value ?? VIES_DEFAULT_GUARANTEED_AMOUNT).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const PracticeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    if (id) {
      loadPractice();
      loadUserRole();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, [id]);

  const loadUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role);
      }
    } catch (error) {
      console.error("Error loading user role:", error);
    }
  };

  const loadPractice = async () => {
    try {
      const { data, error } = await supabase
        .from("practices")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPractice(data);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Errore caricamento pratica",
        description: error instanceof Error ? error.message : "Errore imprevisto durante il caricamento della pratica.",
      });
      navigate("/practices");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: PracticeStatus) => {
    const colors = {
      in_lavorazione: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      completata: "bg-green-500/10 text-green-500 border-green-500/20",
      rifiutata: "bg-red-500/10 text-red-500 border-red-500/20",
      in_attesa: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      approvata: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    };
    return colors[status] || colors.in_lavorazione;
  };

  const getStatusLabel = (status: PracticeStatus) => {
    const labels = {
      in_lavorazione: "In Lavorazione",
      completata: "Completata",
      rifiutata: "Rifiutata",
      in_attesa: "In Attesa",
      approvata: "Approvata",
    };
    return labels[status] || status;
  };

  const getPracticeTypeLabel = (type: PracticeType) => {
    const labels: Record<string, string> = {
      fidejussioni: "Fidejussioni",
      car: "Car",
      postuma_decennale: "Postuma Decennale",
      all_risk: "All Risk",
      responsabilita_civile: "Responsabilità Civile",
      pet: "Pet",
      fotovoltaico: "Fotovoltaico",
      catastrofali: "Catastrofali",
      azienda: "Azienda",
      casa: "Casa",
      risparmio: "Risparmio",
      salute: "Salute",
      auto: "Auto",
      vita: "Vita",
      responsabilita: "Responsabilità Civile",
      vies: "VIES",
      altro: "Altro",
    };
    return labels[type] || type;
  };

  const handleStatusUpdate = () => {
    loadPractice();
  };



  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!practice) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/practices")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna alle Pratiche
          </Button>
        </div>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">
                  {practice.practice_number}
                </h1>
                <Badge className={getStatusColor(practice.status)}>
                  {getStatusLabel(practice.status)}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {getPracticeTypeLabel(practice.practice_type)}
              </p>
            </div>

          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Informazioni Contraente
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{practice.client_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{practice.client_phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{practice.client_email}</span>
                </div>
                {practice.policy_number && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Polizza: {practice.policy_number}</span>
                  </div>
                )}
                {practice.beneficiary && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Beneficiario: {practice.beneficiary}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Creata il: </span>
                  <span className="text-foreground">
                    {new Date(practice.created_at).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ultimo aggiornamento: </span>
                  <span className="text-foreground">
                    {new Date(practice.updated_at).toLocaleDateString("it-IT")}
                  </span>
                </div>
                {practice.policy_start_date && (
                  <div>
                    <span className="text-muted-foreground">Inizio Polizza: </span>
                    <span className="text-foreground">
                      {new Date(practice.policy_start_date).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                )}
                {practice.policy_end_date && (
                  <div>
                    <span className="text-muted-foreground">Fine Polizza: </span>
                    <span className="text-foreground">
                      {new Date(practice.policy_end_date).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                )}
                {practice.policy_start_date && practice.policy_end_date && (
                  <div>
                    <span className="text-muted-foreground">Durata: </span>
                    <span className="text-foreground font-medium">
                      {Math.ceil((new Date(practice.policy_end_date).getTime() - new Date(practice.policy_start_date).getTime()) / (1000 * 60 * 60 * 24 * 365))} anni
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {practice.practice_type === "vies" && (
          <Card className="p-6 border-blue-200 bg-blue-50/60">
            <div className="flex items-start gap-3 mb-5">
              <ShieldCheck className="h-5 w-5 text-blue-700 mt-1" />
              <div>
                <h2 className="text-xl font-semibold text-blue-950">Riepilogo VIES / rischio fideiussorio</h2>
                <p className="text-sm text-blue-900">
                  Dati generati dal caricamento massivo VIES e pronti per il controllo prima della compilazione Annex III.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-sm">
              <div>
                <span className="text-muted-foreground">Importo garantito</span>
                <p className="font-semibold text-foreground">{formatCurrency(practice.premium_gross)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Durata</span>
                <p className="font-semibold text-foreground">36 mesi</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sezione compagnia/garante</span>
                <p className="font-semibold text-foreground">Da lasciare in bianco</p>
              </div>
              <div>
                <span className="text-muted-foreground">Contraente</span>
                <p className="font-semibold text-foreground">{practice.client_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Partita IVA contraente</span>
                <p className="font-semibold text-foreground">{practice.owner_tax_code || "Da verificare"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Beneficiario</span>
                <p className="font-semibold text-foreground">{practice.beneficiary || "Da verificare"}</p>
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <span className="text-muted-foreground">Oggetto della garanzia</span>
                <p className="font-semibold text-foreground">{VIES_GUARANTEE_OBJECT}</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <PracticeStatusForm 
              practiceId={practice.id} 
              currentStatus={practice.status}
              onStatusUpdate={handleStatusUpdate}
              userRole={userRole}
            />
            <PracticeNotes 
              practiceId={practice.id}
              initialNotes={practice.notes || ""}
            />
          </div>
          
          <div className="space-y-6">
            <PracticeTimeline practiceId={practice.id} />
          </div>
        </div>

        <PracticeDocuments practiceId={practice.id} />
      </div>
    </DashboardLayout>
  );
};

export default PracticeDetail;
