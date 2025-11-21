import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Download, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PracticesTableProps {
  searchQuery: string;
}

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";
type PracticeType = "auto" | "casa" | "vita" | "salute" | "responsabilita" | "altro";

interface Practice {
  id: string;
  practice_number: string;
  practice_type: PracticeType;
  client_name: string;
  policy_number: string | null;
  status: PracticeStatus;
  created_at: string;
}

export const PracticesTable = ({ searchQuery }: PracticesTableProps) => {
  const navigate = useNavigate();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPractices();
  }, []);

  const loadPractices = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("practices")
      .select("id, practice_number, practice_type, client_name, policy_number, status, created_at")
      .order("created_at", { ascending: false });

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
      responsabilita: "Responsabilità Civile",
      altro: "Altro",
    };
    return labels[type];
  };

  const filteredPractices = practices.filter((practice) => {
    const query = searchQuery.toLowerCase();
    return (
      practice.practice_number.toLowerCase().includes(query) ||
      practice.client_name.toLowerCase().includes(query) ||
      getPracticeTypeLabel(practice.practice_type).toLowerCase().includes(query) ||
      (practice.policy_number && practice.policy_number.toLowerCase().includes(query))
    );
  });

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numero Pratica</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Polizza</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Caricamento pratiche...
              </TableCell>
            </TableRow>
          ) : filteredPractices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nessuna pratica trovata
              </TableCell>
            </TableRow>
          ) : (
            filteredPractices.map((practice) => (
              <TableRow key={practice.id}>
                <TableCell className="font-medium">{practice.practice_number}</TableCell>
                <TableCell>{practice.client_name}</TableCell>
                <TableCell>{getPracticeTypeLabel(practice.practice_type)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {practice.policy_number || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(practice.created_at).toLocaleDateString("it-IT")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(practice.status)}>
                    {getStatusLabel(practice.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate(`/practices/${practice.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
};
