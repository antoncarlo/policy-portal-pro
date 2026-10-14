import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { formatDateTime, getMessages, useMessages } from "@/i18n";
import { myWorkMessages } from "@/i18n/messages/myWork";

const PAGE_SIZE = 50;

interface EventRow {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  created_by: string | null;
  practice_id: string;
  practices: { practice_number: string; client_name: string } | null;
}

interface Filters {
  search: string;
  from: string;
  to: string;
}

/** Il testo di ricerca senza i caratteri che romperebbero un filtro PostgREST. */
const safeSearch = (value: string) => value.replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Registro delle attivita' del proprio lavoro (agenti e collaboratori): lo storico delle pratiche che l'utente
 * puo' vedere. Il database limita gia' le righe alle sue pratiche (e, per un agente, a quelle dei collaboratori).
 */
export const MyWorkLog = () => {
  const m = useMessages(myWorkMessages).log;
  const { toast } = useToast();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [people, setPeople] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const applied = useRef<Filters>({ search: "", from: "", to: "" });

  /** Il filtro di ricerca (testo o numero pratica) come espressione `or` di PostgREST; null senza ricerca. */
  const searchClause = useCallback(async (filters: Filters) => {
    const text = safeSearch(filters.search);
    if (!text) return null;
    const { data: found } = await supabase.from("practices").select("id").ilike("practice_number", `%${text}%`).limit(200);
    const ids = (found ?? []).map((row) => row.id);
    return ids.length > 0 ? `description.ilike.%${text}%,practice_id.in.(${ids.join(",")})` : `description.ilike.%${text}%`;
  }, []);

  /** La query con i filtri; gli eventi sono letti per data, dal piu' recente. */
  const buildQuery = useCallback((filters: Filters, clause: string | null) => {
    let query = supabase
      .from("practice_events")
      .select("id, event_type, description, created_at, created_by, practice_id, practices!inner(practice_number, client_name)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (clause) query = query.or(clause);
    if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00`);
    if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999`);
    return query;
  }, []);

  const loadPeople = useCallback(async (list: EventRow[]) => {
    const ids = [...new Set(list.map((row) => row.created_by).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    setPeople((current) => {
      const next = new Map(current);
      for (const person of data ?? []) next.set(person.id, person.full_name || person.email || "");
      return next;
    });
  }, []);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      setFailed(false);
      try {
        const query = buildQuery(applied.current, await searchClause(applied.current));
        const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as unknown as EventRow[];
        setRows((current) => (offset === 0 ? page : [...current, ...page]));
        setHasMore(page.length === PAGE_SIZE);
        void loadPeople(page);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, searchClause, loadPeople],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const apply = () => {
    applied.current = { search, from, to };
    void load(0);
  };

  const exportRows = async () => {
    setExporting(true);
    try {
      const clause = await searchClause(applied.current);
      const all = await fetchAllRows<EventRow>((start, end) => buildQuery(applied.current, clause).range(start, end) as never);
      const { data: authors } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [...new Set(all.map((row) => row.created_by).filter((id): id is string => Boolean(id)))]);
      const names = new Map((authors ?? []).map((person) => [person.id, person.full_name || person.email || ""]));
      const text = getMessages(myWorkMessages).log;
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(
        all.map((row) => ({
          [text.date]: formatDateTime(row.created_at),
          [text.practice]: row.practices?.practice_number ?? "",
          [text.event]: row.description,
          [text.author]: row.created_by ? names.get(row.created_by) || "—" : text.system,
        })),
      );
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "log");
      XLSX.writeFile(book, `${text.exportName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      toast({ variant: "destructive", title: getMessages(myWorkMessages).log.error, description: error instanceof Error ? error.message : undefined });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="my-log">
      <Card className="p-6">
        <h2 className="text-xl font-semibold">{m.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.intro}</p>
        <form
          className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="my-log-search">{m.search}</Label>
            <Input id="my-log-search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="my-log-from">{m.from}</Label>
            <Input id="my-log-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="my-log-to">{m.to}</Label>
            <Input id="my-log-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <Button type="submit" variant="outline" data-testid="my-log-apply">
            <Search className="mr-1.5 h-4 w-4" />
            {m.apply}
          </Button>
          <Button type="button" variant="outline" disabled={exporting} onClick={() => void exportRows()} data-testid="my-log-export">
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
            {exporting ? m.exporting : m.export}
          </Button>
        </form>
      </Card>

      <Card className="p-0">
        {failed ? (
          <p className="p-6 text-sm text-destructive">{m.error}</p>
        ) : rows.length === 0 && !loading ? (
          <p className="p-6 text-sm text-muted-foreground">{m.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">{m.date}</th>
                  <th className="px-4 py-2">{m.practice}</th>
                  <th className="px-4 py-2">{m.event}</th>
                  <th className="px-4 py-2">{m.author}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0" data-testid="my-log-row">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-2">
                      <Link to={`/practices/${row.practice_id}`} className="font-mono text-xs text-primary hover:underline">
                        {row.practices?.practice_number ?? row.practice_id}
                      </Link>
                      {row.practices?.client_name && <div className="text-xs text-muted-foreground">{row.practices.client_name}</div>}
                    </td>
                    <td className="px-4 py-2">{row.description}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.created_by ? people.get(row.created_by) || "—" : m.system}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loading && <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></p>}
        {hasMore && !loading && (
          <div className="border-t p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => void load(rows.length)} data-testid="my-log-more">
              {m.loadMore}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
