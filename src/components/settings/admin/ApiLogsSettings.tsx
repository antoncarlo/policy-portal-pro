import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Download, RefreshCw, ChevronLeft, ChevronRight, Link } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ApiLog {
  id: string;
  created_at: string;
  source: string | null;
  ip_address: string | null;
  endpoint: string | null;
  method: string | null;
  status_code: number | null;
  practice_id: string | null;
  api_key_masked: string | null;
  error_message: string | null;
  request_body_size: number | null;
}

const PAGE_SIZE = 50;

function statusBadge(code: number | null) {
  if (code === null) return <Badge variant="outline">—</Badge>;
  if (code >= 500) return <Badge className="bg-red-600 text-white">{code}</Badge>;
  if (code >= 400) return <Badge className="bg-orange-500 text-white">{code}</Badge>;
  if (code >= 200 && code < 300) return <Badge className="bg-green-600 text-white">{code}</Badge>;
  return <Badge variant="outline">{code}</Badge>;
}

function exportCsv(logs: ApiLog[]) {
  const headers = [
    "Data/Ora", "Source", "IP", "Endpoint", "Metodo",
    "Status", "Pratica ID", "API Key", "Errore", "Body Size (bytes)",
  ];
  const rows = logs.map(l => [
    new Date(l.created_at).toLocaleString("it-IT"),
    l.source ?? "",
    l.ip_address ?? "",
    l.endpoint ?? "",
    l.method ?? "",
    l.status_code?.toString() ?? "",
    l.practice_id ?? "",
    l.api_key_masked ?? "",
    l.error_message ?? "",
    l.request_body_size?.toString() ?? "",
  ]);

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `api_logs_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ApiLogsSettings() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadSources = useCallback(async () => {
    const { data } = await supabase
      .from("api_logs")
      .select("source")
      .not("source", "is", null);
    if (data) {
      const unique = [...new Set(data.map(r => r.source as string))].filter(Boolean).sort();
      setSources(unique);
    }
  }, []);

  const loadLogs = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      let query = supabase
        .from("api_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (dateFrom) query = query.gte("created_at", dateFrom + "T00:00:00");
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
      if (sourceFilter !== "all") query = query.eq("source", sourceFilter);
      if (statusFilter === "errors") query = query.gte("status_code", 400);
      if (statusFilter === "success") query = query.eq("status_code", 200);

      const { data, count, error } = await query;
      if (error) throw error;
      setLogs(data ?? []);
      setTotal(count ?? 0);
    } catch (err) {
      console.error("Error loading api logs:", err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, sourceFilter, statusFilter]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    setPage(0);
    loadLogs(0);
  }, [loadLogs]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadLogs(newPage);
  };

  const handleExport = async () => {
    let query = supabase
      .from("api_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("created_at", dateFrom + "T00:00:00");
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
    if (sourceFilter !== "all") query = query.eq("source", sourceFilter);
    if (statusFilter === "errors") query = query.gte("status_code", 400);
    if (statusFilter === "success") query = query.eq("status_code", 200);

    const { data } = await query;
    if (data && data.length > 0) exportCsv(data as ApiLog[]);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Log API Webhook</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tutte le richieste ricevute dall&apos;endpoint <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/webhook-receive-policy</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => loadLogs(page)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || total === 0}>
              <Download className="h-4 w-4 mr-2" />
              Esporta CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label htmlFor="date-from">Dal</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date-to">Al</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {sources.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="success">Solo successi (200)</SelectItem>
                  <SelectItem value="errors">Solo errori (≥400)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Summary */}
        <div className="text-sm text-muted-foreground">
          {loading ? "Caricamento..." : `${total} richieste trovate`}
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data/Ora</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pratica</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Errore</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nessun log trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(log.created_at).toLocaleString("it-IT")}
                      </TableCell>
                      <TableCell className="text-sm font-mono max-w-[120px] truncate">
                        {log.source ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.ip_address ?? "—"}
                      </TableCell>
                      <TableCell>
                        {statusBadge(log.status_code)}
                      </TableCell>
                      <TableCell>
                        {log.practice_id ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-sm text-primary underline-offset-2 hover:underline"
                            onClick={() => navigate(`/practices/${log.practice_id}`)}
                          >
                            <Link className="h-3 w-3 mr-1" />
                            {log.practice_id.slice(0, 8)}…
                          </Button>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {log.api_key_masked ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {log.error_message ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-destructive truncate block cursor-help">
                                {log.error_message.slice(0, 40)}{log.error_message.length > 40 ? "…" : ""}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs break-words">
                              {log.error_message}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {log.request_body_size != null
                          ? log.request_body_size > 1024
                            ? `${(log.request_body_size / 1024).toFixed(1)} KB`
                            : `${log.request_body_size} B`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Pagina {page + 1} di {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Precedente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Successiva
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}
