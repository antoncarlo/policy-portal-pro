import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface ExpiryPractice {
  practice_id: string;
  practice_number: string;
  client_name: string;
  policy_end_date: string;
  days_until_expiry: number;
}

export const ExpiryWidget = () => {
  const navigate = useNavigate();
  const [expiries, setExpiries] = useState<ExpiryPractice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpiries();
  }, []);

  const loadExpiries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc("get_upcoming_expiries", {
        p_user_id: user.id,
        p_days_ahead: 30, // Only next 30 days for widget
        p_practice_type: null,
      });

      if (error) throw error;
      setExpiries((data || []).slice(0, 5)); // Show max 5
    } catch (error) {
      console.error("Error loading expiries:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (days: number) => {
    if (days <= 7) return "destructive";
    if (days <= 15) return "default";
    return "secondary";
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scadenze Imminenti
        </h3>
        {expiries.length > 0 && (
          <Badge variant="destructive">{expiries.length}</Badge>
        )}
      </div>

      {expiries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna scadenza nei prossimi 30 giorni
        </p>
      ) : (
        <div className="space-y-3">
          {expiries.map((expiry) => (
            <div
              key={expiry.practice_id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              onClick={() => navigate(`/practices/${expiry.practice_id}`)}
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{expiry.client_name}</p>
                <p className="text-xs text-muted-foreground">{expiry.practice_number}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getUrgencyColor(expiry.days_until_expiry)} className="text-xs">
                  {expiry.days_until_expiry === 0 ? "Oggi" : `${expiry.days_until_expiry}gg`}
                </Badge>
                {expiry.days_until_expiry <= 7 && (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => navigate("/expiry")}
          >
            Vedi tutte le scadenze
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
};
