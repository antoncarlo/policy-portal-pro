import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, User, Phone, Mail, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PracticeTimeline } from "@/components/practice/PracticeTimeline";
import { PracticeDocuments } from "@/components/practice/PracticeDocuments";
import { PetQuoteDocumentCard } from "@/components/practice/PetQuoteDocumentCard";
import { PracticeNotes } from "@/components/practice/PracticeNotes";
import { PracticeSummaryCard } from "@/components/practice/PracticeSummaryCard";
import { PracticeWorkflowCard } from "@/components/practice/PracticeWorkflowCard";
import { ViesPolicyDocumentCard } from "@/components/practice/ViesPolicyDocumentCard";
import { formatPolicyDuration } from "@/lib/practiceSummary";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { practiceDetailMessages } from "@/i18n/messages/practiceDetail";
import { practiceStatusLabel, practiceTypeLabel } from "@/i18n/messages/domain";
import { PracticeLotBreadcrumb } from "@/components/practice/PracticeLotBreadcrumb";
import { translateDuration } from "@/i18n/summaryText";
import { RenewPracticeButton } from "@/components/practice/RenewPracticeButton";
import { clientsMessages } from "@/i18n/messages/clients";
import { fetchRenewals, fetchRenewalSource, type RenewalLink } from "@/lib/renewals";


type PracticeStatus = "in_lavorazione" | "in_attesa" | "integrazioni" | "approvata" | "rifiutata" | "completata";
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
  financial_status: string | null;
  payment_date: string | null;
  beneficiary: string | null;
  owner_tax_code: string | null;
  pet_microchip: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  premium_net: number | null;
  premium_taxable: number | null;
  premium_taxes: number | null;
  premium_gross: number | null;
  commission_percentage: number | null;
  commission_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vies_batch_id: string | null;
  renewal_of: string | null;
}

const PracticeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [documentsRefreshToken, setDocumentsRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const m = useMessages(practiceDetailMessages);
  const renewalText = useMessages(clientsMessages).expiry;
  const [renewalSource, setRenewalSource] = useState<RenewalLink | null>(null);
  const [renewedBy, setRenewedBy] = useState<RenewalLink | null>(null);

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
      // The practice this one renews, and the one that renewed it: a failure only hides the links.
      const [source, renewals] = await Promise.all([
        fetchRenewalSource(data.renewal_of).catch(() => null),
        fetchRenewals([data.id]).catch(() => new Map<string, RenewalLink>()),
      ]);
      setRenewalSource(source);
      setRenewedBy(renewals.get(data.id) ?? null);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: getMessages(practiceDetailMessages).loadErrorTitle,
        description: error instanceof Error ? error.message : getMessages(practiceDetailMessages).loadErrorText,
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
      integrazioni: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      approvata: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    };
    return colors[status] || colors.in_lavorazione;
  };

  const getStatusLabel = (status: PracticeStatus) => practiceStatusLabel(status);

  const getPracticeTypeLabel = (type: PracticeType) => practiceTypeLabel(type);

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

  // A policy in force (or expired a short while ago) that nobody has renewed yet.
  const daysToExpiry = practice.policy_end_date ? Math.round((Date.parse(`${practice.policy_end_date}T00:00:00Z`) - Date.now()) / 86_400_000) : null;
  const canRenew =
    daysToExpiry !== null &&
    daysToExpiry <= 120 &&
    daysToExpiry >= -365 &&
    ["completata", "approvata", "in_lavorazione"].includes(practice.status) &&
    practice.practice_type !== "vies" &&
    !renewedBy;

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
            {m.back}
          </Button>
          <PracticeLotBreadcrumb batchId={practice.vies_batch_id} practiceId={practice.id} practiceNumber={practice.practice_number} />
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
              {(renewalSource || renewedBy || canRenew) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" data-testid="renewal-links">
                  {renewalSource && (
                    <Link to={`/practices/${renewalSource.id}`} className="text-primary hover:underline" data-testid="renewal-of">
                      {renewalText.renewalOf(renewalSource.practice_number)}
                    </Link>
                  )}
                  {renewedBy ? (
                    <Link to={`/practices/${renewedBy.id}`} className="text-green-600 hover:underline dark:text-green-400" data-testid="renewed-by">
                      {renewalText.renewedBy(renewedBy.practice_number)}
                    </Link>
                  ) : (
                    canRenew && (
                      <RenewPracticeButton
                        practiceId={practice.id}
                        practiceNumber={practice.practice_number}
                        policyStartDate={practice.policy_start_date}
                        policyEndDate={practice.policy_end_date!}
                        onRenewed={setRenewedBy}
                      />
                    )
                  )}
                </div>
              )}
            </div>

          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                {m.clientInfo}
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
                    <span className="text-muted-foreground">{m.policy(practice.policy_number)}</span>
                  </div>
                )}
                {practice.beneficiary && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{m.beneficiary(practice.beneficiary)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {m.dates}
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{m.createdOn}</span>
                  <span className="text-foreground">
                    {formatDate(practice.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{m.updatedOn}</span>
                  <span className="text-foreground">
                    {formatDate(practice.updated_at)}
                  </span>
                </div>
                {practice.policy_start_date && (
                  <div>
                    <span className="text-muted-foreground">{m.policyStart}</span>
                    <span className="text-foreground">
                      {formatDate(practice.policy_start_date)}
                    </span>
                  </div>
                )}
                {practice.policy_end_date && (
                  <div>
                    <span className="text-muted-foreground">{m.policyEnd}</span>
                    <span className="text-foreground">
                      {formatDate(practice.policy_end_date)}
                    </span>
                  </div>
                )}
                {practice.policy_start_date && practice.policy_end_date && (
                  <div>
                    <span className="text-muted-foreground">{m.duration}</span>
                    <span className="text-foreground font-medium">
                      {translateDuration(formatPolicyDuration(practice.policy_start_date, practice.policy_end_date) ?? "—")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <PracticeWorkflowCard
          practice={practice}
          isAdmin={userRole === "admin"}
          onChanged={() => {
            void loadPractice();
            setDocumentsRefreshToken((t) => t + 1);
          }}
        />

        <PracticeSummaryCard practice={practice} />

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <PracticeNotes
              key={practice.updated_at}
              practiceId={practice.id}
              initialNotes={practice.notes || ""}
              onNotesSaved={(notes) => setPractice((prev) => (prev ? { ...prev, notes } : prev))}
            />
          </div>
          
          <div className="space-y-6">
            <PracticeTimeline practiceId={practice.id} />
          </div>
        </div>

        {practice.practice_type === "vies" && (
          <ViesPolicyDocumentCard
            practice={practice}
            onDocumentCreated={() => setDocumentsRefreshToken((t) => t + 1)}
          />
        )}

        {practice.practice_type === "pet" && (
          <PetQuoteDocumentCard
            practice={practice}
            onDocumentCreated={() => setDocumentsRefreshToken((t) => t + 1)}
          />
        )}

        <PracticeDocuments practiceId={practice.id} refreshToken={documentsRefreshToken} canDelete={userRole === "admin"} />
      </div>
    </DashboardLayout>
  );
};

export default PracticeDetail;
