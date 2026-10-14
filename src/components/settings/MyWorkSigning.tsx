import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, ExternalLink, FileSignature } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { chunk, fetchAllRows } from "@/lib/fetchAllRows";
import { fetchPracticeLots, lotTitle, type PracticeLot } from "@/lib/practiceLots";
import { stageOf } from "@/lib/practiceStages";
import { COMPANY_COPY_DOCUMENT_TYPE, SIGNED_DOCUMENT_TYPES, SIGNING_SLOTS, isSigningStage, signingStatus } from "@/lib/signingDocuments";
import { formatDate, useMessages } from "@/i18n";
import { myWorkMessages } from "@/i18n/messages/myWork";
import { signingMessages } from "@/i18n/messages/signing";

interface PracticeRow {
  id: string;
  practice_number: string;
  client_name: string;
  status: string;
  financial_status: string | null;
  vies_batch_id: string | null;
}

interface DocRow {
  practice_id: string;
  file_name: string;
  document_type: string | null;
  created_at: string;
}

interface Entry {
  practice: PracticeRow;
  signed: number;
  total: number;
  companyCopy: boolean;
  sentAt: string | null;
}

/**
 * Documenti da firmare del proprio lavoro (agenti e collaboratori): le pratiche deliberate con lo stato delle firme,
 * per lotto. Le righe sono quelle che l'utente puo' gia' vedere; scaricare e ricaricare in blocco si fa dal lotto.
 */
export const MyWorkSigning = () => {
  const m = useMessages(myWorkMessages).signing;
  const slots = useMessages(signingMessages).slots;
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [lots, setLots] = useState<Map<string, PracticeLot>>(new Map());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const practices = (
        await fetchAllRows<PracticeRow>((from, to) =>
          supabase
            .from("practices")
            .select("id, practice_number, client_name, status, financial_status, vies_batch_id")
            .eq("practice_type", "vies")
            .in("status", ["approvata"])
            .order("practice_number")
            .range(from, to),
        )
      ).filter((practice) => isSigningStage(stageOf(practice)) && stageOf(practice) !== "emessa");

      const ids = practices.map((practice) => practice.id);
      const docs: DocRow[] = [];
      const sent = new Map<string, string | null>();
      for (const part of chunk(ids, 100)) {
        const [{ data: rows }, { data: flows }] = await Promise.all([
          supabase.from("practice_documents").select("practice_id, file_name, document_type, created_at").in("practice_id", part).in("document_type", [...SIGNED_DOCUMENT_TYPES, COMPANY_COPY_DOCUMENT_TYPE]),
          supabase.from("practice_workflow").select("practice_id, signed_sent_at").in("practice_id", part),
        ]);
        docs.push(...((rows ?? []) as DocRow[]));
        for (const flow of flows ?? []) sent.set(flow.practice_id, flow.signed_sent_at);
      }
      const byPractice = new Map<string, DocRow[]>();
      for (const doc of docs) byPractice.set(doc.practice_id, [...(byPractice.get(doc.practice_id) ?? []), doc]);

      const built = practices.map((practice): Entry => {
        const list = byPractice.get(practice.id) ?? [];
        const status = signingStatus(list, stageOf(practice));
        return {
          practice,
          signed: status.filter((item) => item.signed).length,
          total: SIGNING_SLOTS.length,
          companyCopy: list.some((doc) => doc.document_type === COMPANY_COPY_DOCUMENT_TYPE),
          sentAt: sent.get(practice.id) ?? null,
        };
      });
      const batchIds = [...new Set(practices.map((practice) => practice.vies_batch_id).filter((id): id is string => Boolean(id)))];
      const found = batchIds.length > 0 ? await fetchPracticeLots({ batchIds }).catch(() => []) : [];
      if (cancelled) return;
      setLots(new Map(found.map((lot) => [lot.batchId, lot])));
      setEntries(built);
    })().catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries ?? []) {
      const key = entry.practice.vies_batch_id ?? "";
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return [...map.entries()];
  }, [entries]);

  return (
    <div className="space-y-4" data-testid="my-signing">
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          <h2 className="text-xl font-semibold">{m.title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{m.intro}</p>
        <p className="mt-2 text-xs text-muted-foreground">{SIGNING_SLOTS.map((slot) => slots[slot.id].label).join(" → ")}</p>
      </Card>

      {failed ? (
        <Card className="p-6 text-sm text-destructive">{m.error}</Card>
      ) : !entries ? (
        <Card className="p-6 text-sm text-muted-foreground">{m.loading}</Card>
      ) : entries.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground" data-testid="my-signing-none">{m.none}</Card>
      ) : (
        groups.map(([batchId, list]) => {
          const lot = batchId ? lots.get(batchId) : undefined;
          return (
            <Card key={batchId || "none"} className="p-4" data-testid="my-signing-lot">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{lot ? lotTitle(lot, m.lot) : m.noLot}</p>
                  {lot?.representative && <p className="text-xs text-muted-foreground">{lot.representative}</p>}
                </div>
                {batchId && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/practices?lot=${batchId}`}>
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      {m.openLot}
                    </Link>
                  </Button>
                )}
              </div>
              <ul className="divide-y">
                {list.map((entry) => (
                  <li key={entry.practice.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="my-signing-practice">
                    <div className="min-w-0">
                      <Link to={`/practices/${entry.practice.id}`} className="font-mono text-xs text-primary hover:underline">
                        {entry.practice.practice_number}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">{entry.practice.client_name}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!entry.companyCopy && <Badge variant="outline" className="text-amber-600 dark:text-amber-400">{m.missingCopy}</Badge>}
                      <Badge variant="outline">{m.signed(entry.signed, entry.total)}</Badge>
                      {entry.sentAt ? (
                        <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {m.sent(formatDate(entry.sentAt))}
                        </Badge>
                      ) : entry.signed === entry.total ? (
                        <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">{m.complete}</Badge>
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </div>
  );
};
