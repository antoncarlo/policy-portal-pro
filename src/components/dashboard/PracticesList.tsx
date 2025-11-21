import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface PracticesListProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";
type PracticeType = "auto" | "casa" | "vita" | "salute" | "responsabilita" | "altro";

interface Practice {
  id: string;
  practice_number: string;
  practice_type: PracticeType;
  client_name: string;
  status: PracticeStatus;
  created_at: string;
}

export const PracticesList = ({ searchQuery, onSearchChange }: PracticesListProps) => {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPractices();
  }, []);

  const loadPractices = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("practices")
      .select("id, practice_number, practice_type, client_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error loading practices:", error);
    } else {
      setPractices(data || []);
    }

    setLoading(false);
  };

  const getStatusColor = (status: PracticeStatus) => {
    const colors: Record<PracticeStatus, string> = {
      completata: "bg-green-600/10 text-green-600 border-green-600/20",
      in_lavorazione: "bg-chart-2/10 text-chart-2 border-chart-2/20",
      in_attesa: "bg-yellow-600/10 text-yellow-600 border-yellow-600/20",
      approvata: "bg-blue-600/10 text-blue-600 border-blue-600/20",
      rifiutata: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getStatusLabel = (status: PracticeStatus) => {
    const labels: Record<PracticeStatus, string> = {
      completata: "Completata",
      in_lavorazione: "In Lavorazione",
      in_attesa: "In Attesa",
      approvata: "Approvata",
      rifiutata: "Rifiutata",
    };
    return labels[status];
  };

  const getPracticeTypeLabel = (type: PracticeType) => {
    const labels: Record<PracticeType, string> = {
      auto: "Auto",
      casa: "Casa",
      vita: "Vita",
      salute: "Salute",
      responsabilita: "Responsabilità",
      altro: "Altro",
    };
    return labels[type];
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Pratiche Recenti</h2>
        <Link to="/practices">
          <Button variant="ghost" size="sm">
            Vedi Tutte
          </Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca pratiche..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Caricamento pratiche...
          </div>
        ) : practices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nessuna pratica trovata
          </div>
        ) : (
          practices.map((practice) => (
            <div
              key={practice.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold text-foreground">{practice.practice_number}</span>
                  <Badge variant="outline" className={getStatusColor(practice.status)}>
                    {getStatusLabel(practice.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{practice.client_name}</span>
                  <span>•</span>
                  <span>{getPracticeTypeLabel(practice.practice_type)}</span>
                  <span>•</span>
                  <span>{new Date(practice.created_at).toLocaleDateString("it-IT")}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
