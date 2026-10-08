import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MoreVertical, Eye, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { formatDate, useMessages } from "@/i18n";
import { dashboardMessages } from "@/i18n/messages/dashboard";
import { practiceStatusLabel, practiceTypeLabel } from "@/i18n/messages/domain";

interface PracticesListProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";
type PracticeType =
  | "auto"
  | "casa"
  | "vita"
  | "salute"
  | "responsabilita"
  | "fidejussioni"
  | "car"
  | "postuma_decennale"
  | "all_risk"
  | "responsabilita_civile"
  | "pet"
  | "fotovoltaico"
  | "catastrofali"
  | "azienda"
  | "risparmio"
  | "vies"
  | "altro";

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
  const navigate = useNavigate();
  const { toast } = useToast();
  const m = useMessages(dashboardMessages).recent;

  useEffect(() => {
    loadPractices();
  }, []);

  const loadPractices = async () => {
    setLoading(true);
    
    // Get current user's session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    const isAdmin = roleData?.role === 'admin';

    let query = supabase
      .from("practices")
      .select("id, practice_number, practice_type, client_name, status, created_at");

    // Filter by allowed practice types if not admin
    if (!isAdmin) {
      const { data: permissions } = await supabase
        .from("user_product_permissions")
        .select("practice_type")
        .eq("user_id", session.user.id);

      if (permissions && permissions.length > 0) {
        const allowedTypes = permissions.map(p => p.practice_type);
        query = query.in("practice_type", allowedTypes);
      } else {
        // User has no permissions, return empty
        setPractices([]);
        setLoading(false);
        return;
      }
    }

    query = query.order("created_at", { ascending: false }).limit(5);

    const { data, error } = await query;

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

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">{m.title}</h2>
        <Link to="/practices">
          <Button variant="ghost" size="sm">
            {m.viewAll}
          </Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={m.search}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            {m.loading}
          </div>
        ) : practices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {m.empty}
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
                    {practiceStatusLabel(practice.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{practice.client_name}</span>
                  <span>•</span>
                  <span>{practiceTypeLabel(practice.practice_type)}</span>
                  <span>•</span>
                  <span>{formatDate(practice.created_at)}</span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/practices/${practice.id}`)}>
                    <Eye className="mr-2 h-4 w-4" />
                    {m.viewDetail}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(practice.practice_number);
                      toast({ description: m.copied });
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {m.copyNumber}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/practices/${practice.id}`)}>
                    {m.openClient}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
