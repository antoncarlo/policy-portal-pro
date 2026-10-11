import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDate, useMessages } from "@/i18n";
import { clientsMessages } from "@/i18n/messages/clients";
import { renewPractice } from "@/lib/renewals";
import { renewalPeriod } from "@/lib/renewalPeriod";

interface RenewPracticeButtonProps {
  practiceId: string;
  practiceNumber: string;
  /** Dates of the expiring policy: the renewal starts the day it ends and lasts as long. */
  policyStartDate: string | null;
  policyEndDate: string;
  size?: "sm" | "default";
  onRenewed?: (renewal: { id: string; practice_number: string }) => void;
}

/** "Renew": after a confirmation creates the linked practice and opens it. */
export const RenewPracticeButton = ({ practiceId, practiceNumber, policyStartDate, policyEndDate, size = "sm", onRenewed }: RenewPracticeButtonProps) => {
  const m = useMessages(clientsMessages).expiry;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { start, end } = renewalPeriod(policyStartDate, policyEndDate);

  const run = async () => {
    setBusy(true);
    try {
      const result = await renewPractice(practiceId);
      toast({ title: m.renewDone, description: m.renewDoneText(result.practiceNumber) });
      setOpen(false);
      onRenewed?.({ id: result.practiceId, practice_number: result.practiceNumber });
      navigate(`/practices/${result.practiceId}`);
    } catch (error) {
      toast({ variant: "destructive", title: m.renewErrorTitle, description: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant="outline"
        title={m.renewHint}
        data-testid="renew-practice"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <RefreshCw className="mr-1 h-4 w-4" />
        {m.renew}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.renewConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{m.renewConfirmText(practiceNumber, formatDate(start), formatDate(end))}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{m.renewCancel}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="renew-confirm"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void run();
              }}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {busy ? m.renewing : m.renewConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
