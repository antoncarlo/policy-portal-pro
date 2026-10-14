import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { callLot, lotDocumentUrl, uploadLotFile, type LotCycleData } from "@/lib/lotFlowApi";
import { buildClientStatement, type ClientStatement } from "@/lib/lotStatement";
import { saveBlob } from "@/lib/signingTemplates";
import { formatCurrency, formatDateTime, getMessages, useMessages } from "@/i18n";
import { lotCycleMessages } from "@/i18n/messages/lotCycle";

interface BaseProps {
  open: boolean;
  batchId: string;
  data: LotCycleData | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

const errorText = (error: unknown) => {
  const text = getMessages(lotCycleMessages).errors;
  const code = (error as { code?: string } | null)?.code;
  const known = code ? text[code] : undefined;
  const detail = error instanceof Error ? error.message : "";
  return known ? `${known}${detail && detail !== known ? `: ${detail}` : ""}` : detail;
};

/** Il rappresentante fiscale conferma di aver verificato bozze e MUP. */
export const LotVerifyDialog = ({ open, batchId, data, onOpenChange, onDone }: BaseProps) => {
  const m = useMessages(lotCycleMessages);
  const { toast } = useToast();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const missing = data?.cycle.missing.drafts ?? [];
  const practices = data?.cycle.active.length ?? 0;

  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await callLot("lot_confirm_drafts", { batchId });
      toast({ title: m.toast.confirmedTitle, description: m.toast.confirmedText(Number(result.practices ?? practices)) });
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast({ variant: "destructive", title: m.toast.errorTitle, description: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent data-testid="lot-verify-dialog">
        <DialogHeader>
          <DialogTitle>{m.verify.title}</DialogTitle>
          <DialogDescription>{m.verify.text(practices)}</DialogDescription>
        </DialogHeader>
        {missing.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-400">{m.verify.missing(missing.slice(0, 6).join(", "))}</p>}
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} data-testid="lot-verify-check" />
          <span>{m.verify.checkbox}</span>
        </label>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>{m.bulk.cancel}</Button>
          <Button disabled={!checked || busy || missing.length > 0} onClick={() => void confirm()} data-testid="lot-verify-confirm">
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {m.verify.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Il rappresentante fiscale scarica l'estratto conto, lo paga, lo firma e allega estratto firmato e bonifico. */
export const LotPaymentDialog = ({ open, batchId, onOpenChange, onDone }: BaseProps) => {
  const m = useMessages(lotCycleMessages);
  const { toast } = useToast();
  const [statement, setStatement] = useState<ClientStatement | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [signed, setSigned] = useState<File | null>(null);
  const [transfer, setTransfer] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSigned(null);
    setTransfer(null);
    setStatement(null);
    setPreparing(true);
    void buildClientStatement(batchId)
      .then(setStatement)
      .catch((error) => toast({ variant: "destructive", title: getMessages(lotCycleMessages).toast.errorTitle, description: error instanceof Error ? error.message : undefined }))
      .finally(() => setPreparing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the statement is built once per opening
  }, [open, batchId]);

  const send = async () => {
    if (!signed || !transfer) return;
    setBusy(true);
    try {
      const documents = [await uploadLotFile(batchId, signed, "estratto_conto_firmato"), await uploadLotFile(batchId, transfer, "bonifico")];
      await callLot("lot_submit_payment", { batchId, documents });
      toast({ title: m.toast.paymentTitle, description: m.toast.paymentText });
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast({ variant: "destructive", title: m.toast.errorTitle, description: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent data-testid="lot-payment-dialog">
        <DialogHeader>
          <DialogTitle>{m.payment.title}</DialogTitle>
          <DialogDescription>{m.payment.step1}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={!statement}
              onClick={() => statement && saveBlob(statement.blob, statement.fileName)}
              data-testid="lot-payment-statement"
            >
              {preparing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              {m.buttons.downloadStatement}
            </Button>
            {statement && <span className="text-sm text-muted-foreground" data-testid="lot-payment-amount">{m.payment.amount(statement.policies, formatCurrency(statement.total))}</span>}
          </div>
          <p className="text-sm text-muted-foreground">{m.payment.step2}</p>
          <div className="space-y-1.5">
            <Label htmlFor="lot-signed-statement">{m.payment.statement}</Label>
            <Input id="lot-signed-statement" type="file" accept=".pdf,.p7m,application/pdf" onChange={(event) => setSigned(event.target.files?.[0] ?? null)} data-testid="lot-payment-signed" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lot-transfer">{m.payment.transfer}</Label>
            <Input id="lot-transfer" type="file" accept=".pdf,.p7m,image/*,application/pdf" onChange={(event) => setTransfer(event.target.files?.[0] ?? null)} data-testid="lot-payment-transfer" />
          </div>
          {(!signed || !transfer) && <p className="text-xs text-muted-foreground">{m.payment.needBoth}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>{m.bulk.cancel}</Button>
          <Button disabled={!signed || !transfer || busy} onClick={() => void send()} data-testid="lot-payment-send">
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {busy ? m.payment.sending : m.payment.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** L'amministratore controlla estratto conto firmato e bonifico e conferma l'incasso. */
export const LotPaymentCheckDialog = ({ open, batchId, data, onOpenChange, onDone }: BaseProps) => {
  const m = useMessages(lotCycleMessages);
  const { toast } = useToast();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setDate(new Date().toISOString().slice(0, 10));
  }, [open]);

  const openDocument = async (path: string) => {
    try {
      window.open(await lotDocumentUrl(path), "_blank", "noopener");
    } catch (error) {
      toast({ variant: "destructive", title: m.toast.errorTitle, description: errorText(error) });
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await callLot("lot_confirm_payment", { batchId, paymentDate: date });
      toast({ title: m.toast.paymentConfirmedTitle, description: m.toast.paymentConfirmedText(Number(result.registered ?? 0)) });
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast({ variant: "destructive", title: m.toast.errorTitle, description: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const documents = data?.documents ?? [];
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent data-testid="lot-check-dialog">
        <DialogHeader>
          <DialogTitle>{m.check.title}</DialogTitle>
          <DialogDescription>{m.check.text}</DialogDescription>
        </DialogHeader>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.check.noDocs}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2" data-testid="lot-check-doc">
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">{doc.kind === "bonifico" ? m.payment.transfer : m.payment.statement} · {formatDateTime(doc.created_at)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void openDocument(doc.file_path)}>
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  {m.check.open}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="lot-pay-date">{m.check.date}</Label>
          <Input id="lot-pay-date" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>{m.bulk.cancel}</Button>
          <Button disabled={busy || !date} onClick={() => void confirm()} data-testid="lot-check-confirm">
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {m.check.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** L'amministratore registra l'invio dei documenti firmati alla compagnia. */
export const LotSentDialog = ({ open, batchId, onOpenChange, onDone }: BaseProps) => {
  const m = useMessages(lotCycleMessages);
  const { toast } = useToast();
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReference("");
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await callLot("lot_mark_sent", { batchId, reference: reference.trim() || undefined });
      toast({ title: m.toast.sentTitle, description: m.toast.sentText(Number(result.practices ?? 0)) });
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast({ variant: "destructive", title: m.toast.errorTitle, description: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent data-testid="lot-sent-dialog">
        <DialogHeader>
          <DialogTitle>{m.sent.title}</DialogTitle>
          <DialogDescription>{m.sent.text}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="lot-sent-ref">{m.sent.reference}</Label>
          <Input id="lot-sent-ref" value={reference} maxLength={200} onChange={(event) => setReference(event.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>{m.bulk.cancel}</Button>
          <Button disabled={busy} onClick={() => void confirm()} data-testid="lot-sent-confirm">
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {m.sent.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
