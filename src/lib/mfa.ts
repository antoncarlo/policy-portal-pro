// Secondo fattore (TOTP, app di autenticazione) per gli utenti del portale.
// Livelli Supabase: aal1 = solo password, aal2 = password + codice dell'app.
// La verifica e' facoltativa: la attiva l'utente da Impostazioni > Sicurezza. Chi l'ha attivata
// deve inserire il codice a ogni accesso (aal2).
// Il controllo vero sui dati lo fa il database (regole RLS) e le funzioni /api: questo file serve
// a far vedere all'utente la schermata giusta, non a proteggere i dati.
import { supabase } from "@/integrations/supabase/client";

export type MfaGate = "ok" | "challenge";

export interface TotpFactor {
  id: string;
  friendlyName: string | null;
}

export interface TotpEnrollment {
  factorId: string;
  qrCodeUrl: string;
  secret: string;
}

export const MFA_ISSUER = "Tecno Advance MGA";

/** Fattori TOTP gia' verificati dell'utente (quelli non completati non contano). */
export async function listVerifiedTotpFactors(): Promise<TotpFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp ?? []).map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name ?? null }));
}

/** Quale schermata serve all'utente con la sessione corrente. */
export async function getMfaGate(): Promise<MfaGate> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data.currentLevel !== "aal2" && data.nextLevel === "aal2" ? "challenge" : "ok";
}

/** Elimina i tentativi di configurazione lasciati a meta' (non verificati). */
async function removeUnverifiedFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const unverified = (data?.all ?? []).filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
  for (const factor of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
}

/** Il QR arriva come SVG (anche dentro un data URL non codificato: un "#" lo spezzerebbe), quindi lo si ricodifica. */
const toImageUrl = (qrCode: string) => {
  const comma = qrCode.indexOf(",");
  const svg = qrCode.startsWith("data:") && comma >= 0 ? qrCode.slice(comma + 1) : qrCode;
  return svg.trimStart().startsWith("<") ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : qrCode;
};

/** Primo passo: crea il fattore e restituisce QR code e chiave da inserire a mano. */
export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  await removeUnverifiedFactors();
  const friendlyName = `Portale ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName, issuer: MFA_ISSUER });
  if (error) throw error;
  return { factorId: data.id, qrCodeUrl: toImageUrl(data.totp.qr_code), secret: data.totp.secret };
}

/** Controlla il codice a 6 cifre: se e' giusto la sessione passa ad aal2. */
export async function verifyTotpCode(factorId: string, code: string): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw challenge.error;
  const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  if (verified.error) throw verified.error;
}

/** Disattiva un fattore (serve una sessione aal2). */
export async function removeTotpFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/** Il codice dell'app e' di 6 cifre: toglie spazi e altri caratteri. */
export const normalizeTotpCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);


/** Errore "codice sbagliato o scaduto" di Supabase (distinto dagli errori di rete o di sessione). */
export const isInvalidCodeError = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "mfa_verification_failed" || /invalid totp|invalid.*code/i.test(e?.message ?? "");
};
