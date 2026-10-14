import { DIALOG_GLASS, GLASS_INSET, SERIF } from "./lotGlass";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { callLot, fetchLotCycle, uploadPracticeFile, type LotPracticeRow } from "@/lib/lotFlowApi";
import { expandFiles, matchEntries, readEntryTexts, type FileMatch, type LotFileEntry, type RecognitionPractice } from "@/lib/lotRecognition";
import { extractNotesSections } from "@/lib/practiceSummary";
import { stageOf } from "@/lib/practiceStages";
import { useMessages } from "@/i18n";
import { lotCycleMessages } from "@/i18n/messages/lotCycle";
import { workflowMessages } from "@/i18n/messages/workflow";

export type BulkMode = "drafts" | "copies" | "issued";

const CONCURRENCY = 3;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_ISSUED_COPIES = 10;

interface Props {
  open: boolean;
  mode: BulkMode;
  batchId: string;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * L'amministratore carica in blocco le bozze, le polizze copia Compagnia o le polizze emesse di un lotto, come PDF
 * o come ZIP: il portale assegna ogni file alla sua pratica (numero pratica, numero di polizza, nome del cliente),
 * mostra il risultato per correggerlo, poi collega i file e registra il passaggio nel lotto. Ogni pratica registra la
 * propria riga di storico, ma al rappresentante fiscale arriva un solo avviso per il lotto.
 */
export const LotBulkDocumentsDialog = ({ open, mode, batchId, onOpenChange, onDone }: Props) => {
  const m = useMessages(lotCycleMessages).bulk;
  const stages = useMessages(workflowMessages).stages;
  const { toast } = useToast();
  const [practices, setPractices] = useState<LotPracticeRow[]>([]);
  const [entries, setEntries] = useState<LotFileEntry[]>([]);
  // The administrator's own corrections, by file: what the portal recognised stays where he did not touch it.
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  // The text read inside each PDF: the practice is recognised from the content, not only from the file name.
  const [texts, setTexts] = useState<Map<string, string>>(new Map());
  const [readingContent, setReadingContent] = useState<{ done: number; total: number } | null>(null);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ attached: number; failed: string[] } | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // The practices the files can go to: for the drafts, every practice that is not rejected; for the copies, the
  // approved ones; for the issued policies, the paid ones.
  const eligible = useMemo(
    () =>
      practices.filter((practice) => {
        const stage = stageOf(practice);
        if (mode === "drafts") return stage !== "non_deliberata";
        if (mode === "copies") return ["deliberata", "da_emettere", "emessa"].includes(stage);
        return ["da_emettere", "emessa"].includes(stage);
      }),
    [practices, mode],
  );

  useEffect(() => {
    if (!open) return;
    setEntries([]);
    setTexts(new Map());
    setReadingContent(null);
    setOverrides({});
    setIgnored([]);
    setResult(null);
    setRunning(null);
    setPicked(false);
    setDueDate("");
    setNote("");
    void fetchLotCycle(batchId).then((data) => setPractices(data.practices)).catch(() => setPractices([]));
  }, [open, batchId]);

  const choose = async (files: File[]) => {
    if (files.length === 0) return;
    setReading(true);
    setResult(null);
    try {
      const { entries: found, ignored: skipped } = await expandFiles(files);
      const usable = found.filter((entry) => entry.size <= MAX_FILE_BYTES);
      setEntries(usable);
      setTexts(new Map());
      setOverrides({});
      setIgnored([...skipped, ...found.filter((entry) => entry.size > MAX_FILE_BYTES).map((entry) => entry.path)]);
      setPicked(true);
      setReading(false);
      // The files show up at once, recognised by name; the content is read right after and refines it.
      setReadingContent({ done: 0, total: usable.length });
      setTexts(await readEntryTexts(usable, (done, total) => setReadingContent({ done, total })));
      setReadingContent(null);
    } finally {
      setReading(false);
    }
  };

  // The recognition is computed from the files and the practices together: it follows the practices if they load late.
  const recognitionPractices = useMemo<RecognitionPractice[]>(
    () =>
      eligible.map((practice) => ({
        id: practice.id,
        practice_number: practice.practice_number,
        client_name: practice.client_name,
        policy_number: practice.policy_number,
        tax_code: practice.owner_tax_code,
        uscc: String(extractNotesSections(practice.notes).specificFields?.vies_uscc ?? "") || null,
      })),
    [eligible],
  );
  // One draft or one policy copy per practice: two files never get the same practice. The issued policies come in several copies.
  const exclusive = mode !== "issued";
  const recognised = useMemo(() => matchEntries(entries, recognitionPractices, { exclusive, texts }), [entries, recognitionPractices, exclusive, texts]);
  const matches: FileMatch[] = recognised;
  const assignment = (index: number) => (index in overrides ? overrides[index] : recognised[index]?.practiceId ?? null);
  const assigned = matches.map((match, index) => ({ match, practiceId: assignment(index) })).filter((item) => item.practiceId);
  const withoutFile = eligible.filter((practice) => !assigned.some((item) => item.practiceId === practice.id));

  const run = async () => {
    const byPractice = new Map<string, LotFileEntry[]>();
    for (const item of assigned) byPractice.set(item.practiceId as string, [...(byPractice.get(item.practiceId as string) ?? []), item.match.entry]);
    const jobs = [...byPractice.entries()];
    setRunning({ done: 0, total: jobs.length });
    const failed: string[] = [];
    let attached = 0;
    let done = 0;
    const queue = [...jobs];

    const handle = async (practiceId: string, files: LotFileEntry[]) => {
      const practice = practices.find((row) => row.id === practiceId) as LotPracticeRow;
      const stage = stageOf(practice);
      const quiet = true;
      if (mode === "drafts") {
        const uploaded = [];
        for (const [index, file] of files.entries()) uploaded.push(await uploadPracticeFile(practiceId, "bozza_deliberata", file.blob, file.name, index));
        // A practice not yet paid is approved (or approved again) with the draft; a paid one only gets the draft added.
        if (stage === "da_emettere" || stage === "emessa") {
          for (const item of uploaded) await callLot("workflow_attach_document", { practiceId, kind: "draft", document: item.document, quiet });
        } else {
          await callLot("workflow_deliberate", { practiceId, draft: uploaded[0].document, paymentDueDate: dueDate || undefined, note: note.trim() || undefined, quiet });
          for (const item of uploaded.slice(1)) await callLot("workflow_attach_document", { practiceId, kind: "draft", document: item.document, quiet });
        }
      } else if (mode === "copies") {
        for (const [index, file] of files.entries()) {
          const uploaded = await uploadPracticeFile(practiceId, "polizza_copia_compagnia", file.blob, file.name, index);
          await callLot("workflow_attach_document", { practiceId, kind: "company_copy", document: uploaded.document, quiet });
        }
      } else {
        const list = files.slice(0, MAX_ISSUED_COPIES);
        const uploaded = [];
        for (const [index, file] of list.entries()) uploaded.push(await uploadPracticeFile(practiceId, "polizza_emessa", file.blob, file.name, index));
        if (stage === "emessa") {
          for (const item of uploaded) await callLot("workflow_attach_document", { practiceId, kind: "issued_copy", document: item.document, quiet });
        } else {
          await callLot("workflow_issue", { practiceId, documents: uploaded.map((item) => item.document), quiet });
        }
      }
    };

    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const [practiceId, files] = job;
        try {
          await handle(practiceId, files);
          attached += 1;
        } catch (error) {
          const number = practices.find((row) => row.id === practiceId)?.practice_number ?? practiceId;
          failed.push(`${number}: ${error instanceof Error ? error.message : "errore"}`);
        }
        done += 1;
        setRunning({ done, total: jobs.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

    const unmatched = matches.filter((_, index) => !assignment(index)).map((match) => match.entry.path);
    try {
      if (attached > 0) {
        await callLot("lot_record_step", {
          batchId,
          step: mode === "drafts" ? "drafts_uploaded" : mode === "copies" ? "copies_uploaded" : "issued_uploaded",
          summary: { files: matches.length, attached, unmatched, failed },
        });
      }
    } catch (error) {
      failed.push(error instanceof Error ? error.message : "registro del lotto");
    }
    setRunning(null);
    setResult({ attached, failed });
    toast({ title: m.doneTitle, description: m.done(attached, failed.length), variant: failed.length > 0 && attached === 0 ? "destructive" : undefined });
    onDone();
  };

  const busy = running !== null;
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className={`${DIALOG_GLASS} max-h-[90vh] overflow-y-auto sm:max-w-3xl`} data-testid="lot-bulk-dialog">
        <DialogHeader>
          <DialogTitle className={SERIF}>{m.titles[mode]}</DialogTitle>
          <DialogDescription>{m.intros[mode]}</DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            {mode === "drafts" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bulk-due">{m.dueDate}</Label>
                  <Input id="bulk-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={busy} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bulk-note">{m.note}</Label>
                  <Input id="bulk-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} disabled={busy} />
                </div>
              </div>
            )}

            <div>
              <input
                ref={input}
                type="file"
                multiple
                accept=".pdf,.zip,application/pdf,application/zip,application/x-zip-compressed"
                className="hidden"
                data-testid="lot-bulk-input"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void choose(files);
                }}
              />
              <Button type="button" variant="outline" disabled={busy || reading} onClick={() => input.current?.click()} data-testid="lot-bulk-pick">
                {reading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                {reading ? m.reading : m.pick}
              </Button>
            </div>

            {picked && matches.length === 0 && <p className="text-sm text-muted-foreground">{m.noFiles}</p>}

            {matches.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium" data-testid="lot-bulk-summary">{m.recognised(assigned.length, matches.length)}</p>
                {readingContent && <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="lot-bulk-reading"><Loader2 className="h-3.5 w-3.5 animate-spin" />{m.readingContent(readingContent.done, readingContent.total)}</p>}
                <div className={`max-h-72 overflow-y-auto ${GLASS_INSET}`}>
                  <table className="w-full text-sm">
                    <tbody>
                      {matches.map((match, index) => {
                        const value = assignment(index) ?? "";
                        return (
                          <tr key={`${match.entry.path}-${index}`} className={`border-b last:border-0 ${value ? "" : "bg-amber-500/10"}`} data-testid="lot-bulk-row">
                            <td className="max-w-[16rem] truncate px-3 py-1.5" title={match.entry.path}>{match.entry.name}</td>
                            <td className="px-3 py-1.5">
                              <select
                                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                                value={value}
                                disabled={busy}
                                aria-label={`${m.assignTo} ${match.entry.name}`}
                                onChange={(event) => setOverrides((current) => ({ ...current, [index]: event.target.value || null }))}
                              >
                                <option value="">{m.none}</option>
                                {eligible
                                  // A client already given to another file is no longer offered: the list shrinks as files are assigned.
                                  .filter((practice) => !exclusive || practice.id === value || !assigned.some((item) => item.practiceId === practice.id))
                                  .map((practice) => (
                                  <option key={practice.id} value={practice.id}>
                                    {practice.practice_number} · {practice.client_name} {m.stageNote(stages[stageOf(practice)])}
                                  </option>
                                  ))}
                              </select>
                            </td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground">{index in overrides ? "" : match.how ? m.how[match.how] : match.duplicate ? m.duplicate : m.unassigned}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {withoutFile.length > 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400" data-testid="lot-bulk-without">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {m.practicesWithout(withoutFile.length)}: {withoutFile.slice(0, 8).map((practice) => practice.practice_number).join(", ")}
                    {withoutFile.length > 8 ? "…" : ""}
                  </p>
                )}
                {ignored.length > 0 && <p className="text-xs text-muted-foreground">{m.ignored(ignored.length)}</p>}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-2" data-testid="lot-bulk-result">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {m.done(result.attached, result.failed.length)}
            </p>
            {result.failed.length > 0 && (
              <div className="rounded-md border border-destructive/40 p-2 text-xs">
                <p className="mb-1 font-medium">{m.failedTitle}</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {result.failed.slice(0, 10).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>{m.close}</Button>
          ) : (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
                {m.cancel}
              </Button>
              <Button disabled={busy || assigned.length === 0} onClick={() => void run()} data-testid="lot-bulk-run">
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {busy && running ? m.running(running.done, running.total) : m.upload(assigned.length)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
