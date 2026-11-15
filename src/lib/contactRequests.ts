// Le richieste di contatto arrivate dal sito pubblico VIES, come le vedono gli amministratori nelle impostazioni.
// Una richiesta si legge e si segna come gestita: quello che ha scritto chi chiede il contatto non si modifica mai
// (lo impediscono anche i permessi di colonna della tabella contact_requests).

export type ContactRequestStatus = "new" | "handled";

export interface ContactRequestRow {
  id: string;
  created_at: string;
  name: string;
  company: string;
  role: string;
  country: string;
  email: string;
  phone: string | null;
  volume: string | null;
  message: string;
  lang: string;
  page: string | null;
  email_sent: boolean;
  email_error: string | null;
  status: string;
  handled_at: string | null;
  handled_by: string | null;
}

/** Cosa si scrive quando una richiesta cambia stato: chi l'ha gestita e quando, oppure niente se torna da gestire. */
export const contactStatusChange = (status: ContactRequestStatus, userId: string, now: Date) =>
  status === "handled" ? { status, handled_at: now.toISOString(), handled_by: userId } : { status, handled_at: null, handled_by: null };

export const countToHandle = (rows: Array<Pick<ContactRequestRow, "status">>) => rows.filter((row) => row.status !== "handled").length;

/** Il link per rispondere: l'indirizzo di chi ha scritto non puo' aggiungere altri destinatari o un testo. */
export const contactReplyHref = (row: Pick<ContactRequestRow, "email" | "company">) =>
  `mailto:${encodeURIComponent(row.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(`Richiesta di contatto VIES: ${row.company}`)}`;
