import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MfaEnroll } from "@/components/auth/MfaEnroll";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { mfaMessages } from "@/i18n/messages/mfa";
import { listVerifiedTotpFactors, removeTotpFactor, type TotpFactor } from "@/lib/mfa";

/** Impostazioni > Sicurezza: attivare o disattivare la verifica in due passaggi del proprio account. */
export const MfaSettings = () => {
  const m = useMessages(mfaMessages).settings;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    try {
      setFactors(await listVerifiedTotpFactors());
    } catch {
      toast({ variant: "destructive", title: getMessages(commonMessages).error, description: getMessages(mfaMessages).settings.loadError });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const disable = async () => {
    setDisabling(true);
    try {
      for (const factor of factors) await removeTotpFactor(factor.id);
      toast({ title: getMessages(commonMessages).success, description: getMessages(mfaMessages).settings.disabled });
      setConfirmDisable(false);
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: getMessages(commonMessages).error, description: e instanceof Error ? e.message : "" });
    } finally {
      setDisabling(false);
    }
  };

  const enabled = factors.length > 0;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{m.title}</h2>
        {!loading && <Badge variant={enabled ? "default" : "outline"}>{enabled ? m.statusOn : m.statusOff}</Badge>}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{m.description}</p>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : enrolling ? (
        <div className="max-w-md">
          <MfaEnroll
            autoStart
            onDone={() => {
              setEnrolling(false);
              void load();
            }}
            onCancel={() => setEnrolling(false)}
          />
        </div>
      ) : enabled ? (
        <div className="space-y-3">
          <Button variant="outline" onClick={() => setConfirmDisable(true)}>
            {m.disable}
          </Button>
          <p className="text-xs text-muted-foreground">{m.recovery}</p>
        </div>
      ) : (
        <Button onClick={() => setEnrolling(true)}>{m.enable}</Button>
      )}

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.disableTitle}</AlertDialogTitle>
            <AlertDialogDescription>{m.disableText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disabling}>{getMessages(commonMessages).cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={disable} disabled={disabling}>
              {disabling ? m.disabling : m.disableConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
