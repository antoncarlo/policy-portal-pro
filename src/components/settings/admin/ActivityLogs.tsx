import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, Search, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ActivityLog {
  id: string;
  user_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  action: string;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export const ActivityLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("activity_logs")
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (eventTypeFilter !== "all") {
        query = query.eq("event_type", eventTypeFilter);
      }

      if (dateFrom) {
        query = query.gte("created_at", new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        query = query.lte("created_at", new Date(dateTo).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error("Error loading logs:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare i log attività",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.event_type.toLowerCase().includes(searchLower) ||
      (log.profiles?.full_name || "").toLowerCase().includes(searchLower) ||
      (log.profiles?.email || "").toLowerCase().includes(searchLower)
    );
  });

  const exportToExcel = () => {
    const exportData = filteredLogs.map((log) => ({
      "Data/Ora": format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      Utente: log.profiles?.full_name || "Sistema",
      Email: log.profiles?.email || "-",
      "Tipo Evento": log.event_type,
      Azione: log.action,
      "Tipo Entità": log.entity_type || "-",
      "IP Address": log.ip_address || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Attività");
    XLSX.writeFile(wb, `activity_logs_${format(new Date(), "yyyyMMdd")}.xlsx`);

    toast({
      title: "Successo",
      description: "Log esportati in Excel",
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Log Attività Portale", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generato il ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);

    const tableData = filteredLogs.map((log) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm"),
      log.profiles?.full_name || "Sistema",
      log.event_type,
      log.action,
      log.entity_type || "-",
    ]);

    autoTable(doc, {
      startY: 28,
      head: [["Data/Ora", "Utente", "Tipo", "Azione", "Entità"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save(`activity_logs_${format(new Date(), "yyyyMMdd")}.pdf`);

    toast({
      title: "Successo",
      description: "Log esportati in PDF",
    });
  };

  const getEventTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      login: "bg-green-100 text-green-800",
      logout: "bg-gray-100 text-gray-800",
      create: "bg-blue-100 text-blue-800",
      update: "bg-yellow-100 text-yellow-800",
      delete: "bg-red-100 text-red-800",
      error: "bg-red-100 text-red-800",
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type] || "bg-gray-100 text-gray-800"}`}>
        {type}
      </span>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Log Attività</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="space-y-2">
          <Label htmlFor="search">Ricerca</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Cerca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="event_type">Tipo Evento</Label>
          <select
            id="event_type"
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              loadLogs();
            }}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="all">Tutti</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="create">Creazione</option>
            <option value="update">Modifica</option>
            <option value="delete">Eliminazione</option>
            <option value="error">Errore</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_from">Da</Label>
          <Input
            id="date_from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              loadLogs();
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_to">A</Label>
          <Input
            id="date_to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              loadLogs();
            }}
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Data/Ora</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Utente</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Azione</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Entità</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Caricamento...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nessun log trovato
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium">{log.profiles?.full_name || "Sistema"}</div>
                        <div className="text-xs text-muted-foreground">{log.profiles?.email || "-"}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{getEventTypeBadge(log.event_type)}</td>
                    <td className="px-4 py-3 text-sm">{log.action}</td>
                    <td className="px-4 py-3 text-sm">{log.entity_type || "-"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{log.ip_address || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        Mostrati {filteredLogs.length} di {logs.length} log
      </div>
    </Card>
  );
};
