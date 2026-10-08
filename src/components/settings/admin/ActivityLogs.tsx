import { getLanguage, getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { systemMessages } from "@/i18n/messages/system";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { FileDown, Search, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ActivityLogProfile {
  full_name: string | null;
  email: string | null;
}

interface ActivityLog {
  id: string;
  user_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  action: string;
  details: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: ActivityLogProfile;
}

type LogTexts = (typeof systemMessages)["it"]["logs"];

const eventLabel = (type: string, text: LogTexts) => text.events[type as keyof LogTexts["events"]] ?? type;

export const ActivityLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const m = useMessages(systemMessages).logs;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("activity_logs")
        .select("*")
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

      const activityLogs = (data || []).map((log) => ({
        ...log,
        ip_address: typeof log.ip_address === "string" ? log.ip_address : log.ip_address ? String(log.ip_address) : null,
      })) as ActivityLog[];
      const userIds = Array.from(new Set(activityLogs.map((log) => log.user_id).filter((id): id is string => Boolean(id))));
      const profilesById = new Map<string, ActivityLogProfile>();

      if (userIds.length) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", userIds);

        if (profilesError) {
          console.warn("Profile enrichment for activity logs failed:", profilesError);
        } else {
          profilesData?.forEach((profile) => {
            profilesById.set(profile.id, {
              full_name: profile.full_name,
              email: profile.email,
            });
          });
        }
      }

      setLogs(activityLogs.map((log) => ({
        ...log,
        profiles: log.user_id ? profilesById.get(log.user_id) : undefined,
      })));
    } catch (error) {
      console.error("Error loading logs:", error);
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(systemMessages).logs.loadError,
      });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, eventTypeFilter, toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

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
    const text = getMessages(systemMessages).logs;
    const exportData = filteredLogs.map((log) => ({
      [text.dateTime]: format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      [text.user]: log.profiles?.full_name || text.system,
      Email: log.profiles?.email || "-",
      [text.eventType]: eventLabel(log.event_type, text),
      [text.action]: log.action,
      [text.entityType]: log.entity_type || "-",
      [text.ipAddress]: log.ip_address || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, text.sheet);
    XLSX.writeFile(wb, `activity_logs_${format(new Date(), "yyyyMMdd")}.xlsx`);

    toast({
      title: getMessages(commonMessages).success,
      description: text.exportedExcel,
    });
  };

  const exportToPDF = () => {
    // jsPDF has no CJK glyphs: the Chinese interface exports the PDF in English.
    const language = getLanguage();
    const text = systemMessages[language === "zh" ? "en" : language].logs;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(text.pdfTitle, 14, 15);
    doc.setFontSize(10);
    doc.text(text.generatedOn(format(new Date(), "dd/MM/yyyy HH:mm")), 14, 22);

    const tableData = filteredLogs.map((log) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm"),
      log.profiles?.full_name || text.system,
      eventLabel(log.event_type, text),
      log.action,
      log.entity_type || "-",
    ]);

    autoTable(doc, {
      startY: 28,
      head: [[text.dateTime, text.user, text.type, text.action, text.entity]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save(`activity_logs_${format(new Date(), "yyyyMMdd")}.pdf`);

    toast({
      title: getMessages(commonMessages).success,
      description: getMessages(systemMessages).logs.exportedPdf,
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
        {eventLabel(type, m)}
      </span>
    );
  };

  return (
    <Card className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Calendar className="h-5 w-5" />
          <h2 className="min-w-0 break-words text-xl font-semibold">{m.title}</h2>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" size="sm" onClick={exportToExcel} className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
            <FileDown className="mr-2 h-4 w-4 shrink-0" />
            <span>Excel</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
            <FileDown className="mr-2 h-4 w-4 shrink-0" />
            <span>PDF</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="space-y-2">
          <Label htmlFor="search">{m.search}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder={m.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="event_type">{m.eventType}</Label>
          <select
            id="event_type"
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
            }}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="all">{m.all}</option>
            <option value="login">{m.events.login}</option>
            <option value="logout">{m.events.logout}</option>
            <option value="create">{m.events.create}</option>
            <option value="update">{m.events.update}</option>
            <option value="delete">{m.events.delete}</option>
            <option value="error">{m.events.error}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_from">{m.from}</Label>
          <Input
            id="date_from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_to">{m.to}</Label>
          <Input
            id="date_to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
            }}
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.dateTime}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.user}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.type}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.action}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.entity}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.ip}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {getMessages(commonMessages).loading}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {m.empty}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="max-w-[220px] break-words font-medium">{log.profiles?.full_name || m.system}</div>
                        <div className="max-w-[260px] break-all text-xs text-muted-foreground">{log.profiles?.email || "-"}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{getEventTypeBadge(log.event_type)}</td>
                    <td className="max-w-[260px] break-words px-4 py-3 text-sm">{log.action}</td>
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
        {m.shown(filteredLogs.length, logs.length)}
      </div>
    </Card>
  );
};
