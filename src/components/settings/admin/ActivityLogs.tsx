import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, FileDown, Search } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getLanguage, getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { systemMessages } from "@/i18n/messages/system";

const PAGE_SIZE = 50;

interface AuditLine {
  id: number;
  at: string;
  actor_id: string | null;
  actor_role: string | null;
  source: string;
  table_name: string | null;
  row_id: string | null;
  action: string;
  old_data: Json | null;
  new_data: Json | null;
  changed_keys: string[] | null;
  details: Json | null;
  ip: string | null;
  user_agent: string | null;
}

interface Person {
  full_name: string | null;
  email: string | null;
}

type LogTexts = (typeof systemMessages)["it"]["logs"];

const ACTION_FILTERS = [
  "insert", "update", "delete", "session.login", "session.logout", "user.create", "user.disable", "user.delete", "user.reassign", "user.reset_mfa",
  "user.password_changed", "practice.deliberate", "practice.reject", "practice.request_info", "practice.issue", "practice.reopen", "practice.register_payment",
];
const TABLE_FILTERS = [
  "practices", "clients", "profiles", "user_roles", "user_product_permissions", "api_keys", "api_key_user_mapping", "partner_webhooks", "practice_documents",
  "system_settings", "vies_batches", "vies_fiscal_representatives", "app",
];

const actionLabel = (action: string, text: LogTexts) => text.actions[action] ?? action;
const tableLabel = (table: string | null, text: LogTexts) => (table ? text.tables[table] ?? table : "-");
const valueText = (value: Json | undefined) => (value === undefined || value === null ? "—" : typeof value === "string" ? value : JSON.stringify(value));
const asRecord = (value: Json | null): Record<string, Json> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>) : {});

const actionColor = (action: string) =>
  action === "delete" || action === "user.delete"
    ? "bg-red-100 text-red-800"
    : action === "insert" || action === "user.create"
      ? "bg-blue-100 text-blue-800"
      : action === "update"
        ? "bg-yellow-100 text-yellow-800"
        : action.startsWith("session.")
          ? "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-800";

/** The audit log: who did what and when, with what changed. Read only: the database does not allow editing it. */
export const ActivityLogs = () => {
  const { toast } = useToast();
  const m = useMessages(systemMessages).logs;
  const [lines, setLines] = useState<AuditLine[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<AuditLine | null>(null);

  const fetchLines = useCallback(
    async (from: number) => {
      let actorIds: string[] | null = null;
      const term = userSearch.trim().replace(/[%,()]/g, " ");
      if (term) {
        const { data: found } = await supabase.from("profiles").select("id").or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(50);
        actorIds = (found ?? []).map((row) => row.id);
        if (actorIds.length === 0) return { rows: [] as AuditLine[], more: false };
      }
      let query = supabase.from("audit_log").select("*").order("at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (actorIds) query = query.in("actor_id", actorIds);
      if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      if (dateFrom) query = query.gte("at", new Date(`${dateFrom}T00:00:00`).toISOString());
      if (dateTo) query = query.lte("at", new Date(`${dateTo}T23:59:59.999`).toISOString());
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as AuditLine[];
      return { rows, more: rows.length === PAGE_SIZE };
    },
    [userSearch, tableFilter, actionFilter, dateFrom, dateTo],
  );

  const loadPeople = useCallback(async (rows: AuditLine[]) => {
    const missing = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
    if (missing.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", missing);
    setPeople((current) => {
      const next = new Map(current);
      for (const row of data ?? []) next.set(row.id, { full_name: row.full_name, email: row.email });
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, more } = await fetchLines(0);
      setLines(rows);
      setHasMore(more);
      await loadPeople(rows);
    } catch (error) {
      console.error("Error loading the audit log:", error);
      toast({ variant: "destructive", title: getMessages(commonMessages).error, description: getMessages(systemMessages).logs.loadError });
    } finally {
      setLoading(false);
    }
  }, [fetchLines, loadPeople, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    try {
      const { rows, more } = await fetchLines(lines.length);
      setLines((current) => [...current, ...rows]);
      setHasMore(more);
      await loadPeople(rows);
    } catch (error) {
      console.error("Error loading more:", error);
    }
  };

  const who = (line: AuditLine) => (line.actor_id ? people.get(line.actor_id) : undefined);
  const itemText = (line: AuditLine) => {
    const details = asRecord(line.details);
    const hint = typeof details.email === "string" ? details.email : typeof details.full_name === "string" ? details.full_name : "";
    return [tableLabel(line.table_name, m), line.row_id ? line.row_id.slice(0, 8) : "", hint].filter(Boolean).join(" · ");
  };
  const changesText = (line: AuditLine) => (line.changed_keys?.length ? line.changed_keys.join(", ") : "");

  const exportToExcel = () => {
    const text = getMessages(systemMessages).logs;
    const data = lines.map((line) => ({
      [text.dateTime]: format(new Date(line.at), "dd/MM/yyyy HH:mm:ss"),
      [text.user]: who(line)?.full_name || (line.actor_id ? line.actor_id : text.system),
      Email: who(line)?.email || "-",
      [text.action]: actionLabel(line.action, text),
      [text.table]: tableLabel(line.table_name, text),
      ID: line.row_id || "-",
      [text.changes]: changesText(line) || "-",
      [text.before]: line.old_data ? JSON.stringify(line.old_data) : "-",
      [text.after]: line.new_data ? JSON.stringify(line.new_data) : line.details ? JSON.stringify(line.details) : "-",
      [text.ip]: line.ip || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, text.sheet);
    XLSX.writeFile(wb, `audit_log_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast({ title: getMessages(commonMessages).success, description: text.exportedExcel });
  };

  const exportToPDF = () => {
    // jsPDF has no CJK glyphs: the Chinese interface exports the PDF in English.
    const language = getLanguage();
    const text = systemMessages[language === "zh" ? "en" : language].logs;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(text.pdfTitle, 14, 15);
    doc.setFontSize(10);
    doc.text(text.generatedOn(format(new Date(), "dd/MM/yyyy HH:mm")), 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [[text.dateTime, text.user, text.action, text.item, text.changes, text.ip]],
      body: lines.map((line) => [
        format(new Date(line.at), "dd/MM/yyyy HH:mm"),
        who(line)?.full_name || (line.actor_id ? line.actor_id.slice(0, 8) : text.system),
        actionLabel(line.action, text),
        itemText(line),
        changesText(line),
        line.ip || "-",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [66, 139, 202] },
    });
    doc.save(`audit_log_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast({ title: getMessages(commonMessages).success, description: text.exportedPdf });
  };

  const detailRows = (line: AuditLine) => {
    const before = asRecord(line.old_data);
    const after = asRecord(line.new_data);
    const keys = line.changed_keys?.length ? line.changed_keys : [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.map((key) => ({ key, before: before[key], after: after[key] }));
  };

  return (
    <Card className="p-6" data-testid="audit-log">
      <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
      <p className="mb-6 text-sm text-muted-foreground">{m.intro}</p>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="audit-user">{m.search}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="audit-user" placeholder={m.searchPlaceholder} value={userSearch} onChange={(event) => setUserSearch(event.target.value)} className="pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-table">{m.table}</Label>
          <select id="audit-table" value={tableFilter} onChange={(event) => setTableFilter(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
            <option value="all">{m.all}</option>
            {TABLE_FILTERS.map((table) => (
              <option key={table} value={table}>
                {tableLabel(table, m)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-action">{m.action}</Label>
          <select id="audit-action" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
            <option value="all">{m.all}</option>
            {ACTION_FILTERS.map((action) => (
              <option key={action} value={action}>
                {actionLabel(action, m)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-from">{m.from}</Label>
          <Input id="audit-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-to">{m.to}</Label>
          <Input id="audit-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.dateTime}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.user}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.action}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.item}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{m.changes}</th>
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
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {m.empty}
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="hover:bg-muted/50" data-testid="audit-line">
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{format(new Date(line.at), "dd/MM/yyyy HH:mm:ss")}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="max-w-[220px] break-words font-medium">{who(line)?.full_name || (line.actor_id ? line.actor_id.slice(0, 8) : m.system)}</div>
                      <div className="max-w-[240px] break-all text-xs text-muted-foreground">{who(line)?.email || line.actor_role || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${actionColor(line.action)}`}>{actionLabel(line.action, m)}</span>
                    </td>
                    <td className="max-w-[260px] break-words px-4 py-3 text-sm">{itemText(line)}</td>
                    <td className="px-4 py-3 text-sm">
                      {changesText(line) || line.old_data || line.new_data || line.details ? (
                        <button type="button" className="max-w-[240px] break-words text-left text-primary hover:underline" onClick={() => setSelected(line)} data-testid="audit-detail">
                          {changesText(line) || m.detail}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{line.ip || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{m.shown(lines.length)}</span>
        {hasMore && (
          <Button variant="outline" size="sm" onClick={() => void loadMore()} data-testid="audit-more">
            {m.loadMore}
          </Button>
        )}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]" data-testid="audit-dialog">
          <DialogHeader>
            <DialogTitle>{m.dialogTitle}</DialogTitle>
            <DialogDescription>
              {selected ? `${actionLabel(selected.action, m)} · ${itemText(selected)} · ${format(new Date(selected.at), "dd/MM/yyyy HH:mm:ss")}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">{m.who}</dt>
                <dd>{who(selected)?.full_name || (selected.actor_id ?? m.system)} {who(selected)?.email ? `(${who(selected)?.email})` : ""}</dd>
                <dt className="text-muted-foreground">{m.fromIp}</dt>
                <dd>{selected.ip || "-"}</dd>
                <dt className="text-muted-foreground">{m.copyId}</dt>
                <dd className="break-all">{selected.row_id || "-"}</dd>
              </dl>
              {detailRows(selected).length > 0 ? (
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">{m.field}</th>
                      <th className="px-3 py-2 text-left">{m.before}</th>
                      <th className="px-3 py-2 text-left">{m.after}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detailRows(selected).map((row) => (
                      <tr key={row.key}>
                        <td className="px-3 py-2 font-mono text-xs">{row.key}</td>
                        <td className="max-w-[240px] break-words px-3 py-2 text-muted-foreground">{valueText(row.before)}</td>
                        <td className="max-w-[240px] break-words px-3 py-2">{valueText(row.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : selected.details ? (
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(selected.details, null, 2)}</pre>
              ) : (
                <p className="text-muted-foreground">{m.noDetail}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
