import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertTriangle, Clock, Mail, Phone, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ExpiryPractice {
  practice_id: string;
  practice_number: string;
  practice_type: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  policy_end_date: string;
  days_until_expiry: number;
  notification_90_sent: boolean;
  notification_60_sent: boolean;
  notification_30_sent: boolean;
  notification_7_sent: boolean;
  user_id: string;
  user_full_name: string;
}

export const ExpiryDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expiries, setExpiries] = useState<ExpiryPractice[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    loadExpiries();
  }, []);

  const loadExpiries = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data, error } = await supabase.rpc("get_upcoming_expiries", {
        p_user_id: user.id,
        p_days_ahead: 90,
        p_practice_type: null,
      });

      if (error) throw error;
      setExpiries(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore caricamento",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (days: number) => {
    if (days <= 7) return "destructive";
    if (days <= 30) return "default";
    if (days <= 60) return "secondary";
    return "outline";
  };

  const getUrgencyIcon = (days: number) => {
    if (days <= 7) return <AlertTriangle className="h-4 w-4" />;
    if (days <= 30) return <Clock className="h-4 w-4" />;
    return <Calendar className="h-4 w-4" />;
  };

  const getUrgencyLabel = (days: number) => {
    if (days <= 7) return "URGENTE";
    if (days <= 30) return "Scade presto";
    if (days <= 60) return "Scade tra 60gg";
    return "Scade tra 90gg";
  };

  const groupedExpiries = {
    urgent: expiries.filter((e) => e.days_until_expiry <= 7),
    soon: expiries.filter((e) => e.days_until_expiry > 7 && e.days_until_expiry <= 30),
    upcoming: expiries.filter((e) => e.days_until_expiry > 30),
  };

  const renderExpiryCard = (expiry: ExpiryPractice) => (
    <Card
      key={expiry.practice_id}
      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/practices/${expiry.practice_id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{expiry.client_name}</h4>
            <Badge variant={getUrgencyColor(expiry.days_until_expiry)}>
              {getUrgencyIcon(expiry.days_until_expiry)}
              <span className="ml-1">{expiry.days_until_expiry} giorni</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {expiry.practice_number} • {expiry.practice_type}
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Scadenza: {new Date(expiry.policy_end_date).toLocaleDateString("it-IT")}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{expiry.client_email}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>{expiry.client_phone}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <div className="flex gap-1">
          <Badge variant={expiry.notification_90_sent ? "default" : "outline"} className="text-xs">
            90gg
          </Badge>
          <Badge variant={expiry.notification_60_sent ? "default" : "outline"} className="text-xs">
            60gg
          </Badge>
          <Badge variant={expiry.notification_30_sent ? "default" : "outline"} className="text-xs">
            30gg
          </Badge>
          <Badge variant={expiry.notification_7_sent ? "default" : "outline"} className="text-xs">
            7gg
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/practices/${expiry.practice_id}`);
          }}
        >
          <FileText className="h-4 w-4 mr-1" />
          Dettagli
        </Button>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Urgenti (≤7gg)</p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-300">{groupedExpiries.urgent.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Prossime (≤30gg)</p>
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{groupedExpiries.soon.length}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </Card>

        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Future (≤90gg)</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{groupedExpiries.upcoming.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Urgent Expiries */}
      {groupedExpiries.urgent.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Scadenze Urgenti (entro 7 giorni)
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedExpiries.urgent.map(renderExpiryCard)}
          </div>
        </div>
      )}

      {/* Soon Expiries */}
      {groupedExpiries.soon.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
            Scadenze Prossime (8-30 giorni)
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedExpiries.soon.map(renderExpiryCard)}
          </div>
        </div>
      )}

      {/* Upcoming Expiries */}
      {groupedExpiries.upcoming.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scadenze Future (31-90 giorni)
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedExpiries.upcoming.map(renderExpiryCard)}
          </div>
        </div>
      )}

      {expiries.length === 0 && (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nessuna scadenza imminente</h3>
          <p className="text-muted-foreground">
            Non ci sono polizze in scadenza nei prossimi 90 giorni
          </p>
        </Card>
      )}
    </div>
  );
};
