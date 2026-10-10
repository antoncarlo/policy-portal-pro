import { useEffect, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useMessages } from "@/i18n";
import { mfaMessages } from "@/i18n/messages/mfa";
import { isInvalidCodeError, listVerifiedTotpFactors, verifyTotpCode, type TotpFactor } from "@/lib/mfa";

interface MfaChallengeProps {
  onVerified: () => void;
  onSignOut: () => void;
}

/** Secondo passo dell'accesso: codice a 6 cifre dell'app di autenticazione. */
export const MfaChallenge = ({ onVerified, onSignOut }: MfaChallengeProps) => {
  const m = useMessages(mfaMessages).challenge;
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listVerifiedTotpFactors()
      .then((factors) => !cancelled && setFactor(factors[0] ?? null))
      .catch(() => !cancelled && setFactor(null))
      .finally(() => !cancelled && setLoadingFactor(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const verify = async (value: string) => {
    if (!factor || value.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyTotpCode(factor.id, value);
      onVerified();
    } catch (e) {
      setCode("");
      setError(isInvalidCodeError(e) ? m.invalidCode : e instanceof Error ? e.message : m.invalidCode);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">{m.title}</h2>
        <p className="mt-2 text-muted-foreground">{m.description}</p>
      </div>

      {loadingFactor ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !factor ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {m.noFactor}
        </p>
      ) : (
        <div className="space-y-3">
          <Label className="block text-center">{m.codeLabel}</Label>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={verify} pattern={REGEXP_ONLY_DIGITS} autoFocus disabled={verifying} aria-label={m.codeLabel}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button className="w-full" onClick={() => verify(code)} disabled={verifying || code.length !== 6}>
            {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {verifying ? m.verifying : m.verify}
          </Button>
        </div>
      )}

      <Button variant="ghost" className="w-full" onClick={onSignOut} disabled={verifying}>
        {m.signOut}
      </Button>
    </div>
  );
};
