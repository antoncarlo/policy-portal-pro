import { useCallback, useEffect, useRef, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { mfaMessages } from "@/i18n/messages/mfa";
import { isInvalidCodeError, startTotpEnrollment, verifyTotpCode, type TotpEnrollment } from "@/lib/mfa";

interface MfaEnrollProps {
  /** Avvia subito la configurazione (pagina obbligatoria) invece di aspettare il pulsante. */
  autoStart?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}

/** Configurazione guidata dell'app di autenticazione: QR code, chiave manuale e verifica del primo codice. */
export const MfaEnroll = ({ autoStart = false, onDone, onCancel }: MfaEnrollProps) => {
  const m = useMessages(mfaMessages).enroll;
  const { toast } = useToast();
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      setEnrollment(await startTotpEnrollment());
    } catch (e) {
      toast({ variant: "destructive", title: getMessages(commonMessages).error, description: e instanceof Error ? e.message : getMessages(mfaMessages).enroll.genericError });
    } finally {
      setStarting(false);
    }
  }, [toast]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void start();
    }
  }, [autoStart, start]);

  const verify = async (value: string) => {
    if (!enrollment || value.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyTotpCode(enrollment.factorId, value);
      toast({ title: getMessages(commonMessages).success, description: getMessages(mfaMessages).enroll.done });
      onDone();
    } catch (e) {
      setCode("");
      setError(isInvalidCodeError(e) ? getMessages(mfaMessages).enroll.invalidCode : e instanceof Error ? e.message : getMessages(mfaMessages).enroll.genericError);
    } finally {
      setVerifying(false);
    }
  };

  if (!enrollment) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{m.intro}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>{m.step1}</li>
          <li>{m.step2}</li>
          <li>{m.step3}</li>
        </ol>
        <div className="flex gap-2">
          <Button onClick={start} disabled={starting}>
            {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {starting ? m.starting : m.start}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={starting}>
              {m.cancel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{m.step2}</p>
      <div className="flex justify-center rounded-md border bg-white p-3">
        <img src={enrollment.qrCodeUrl} alt="QR code" className="h-48 w-48" />
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">{m.secretLabel}</p>
        <code className="block select-all break-all rounded bg-muted px-2 py-1 font-mono text-xs">{enrollment.secret}</code>
      </div>
      <div className="space-y-2">
        <Label>{m.step3}</Label>
        <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={verify} pattern={REGEXP_ONLY_DIGITS} autoFocus disabled={verifying} aria-label={m.codeLabel}>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => verify(code)} disabled={verifying || code.length !== 6}>
          {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {verifying ? m.verifying : m.verify}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={verifying}>
            {m.cancel}
          </Button>
        )}
      </div>
    </div>
  );
};
