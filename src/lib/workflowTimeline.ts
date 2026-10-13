import { getMessages } from "@/i18n";
import { workflowMessages } from "@/i18n/messages/workflow";

/**
 * The history lines written by the server for the flow with the company are in Italian
 * (api/_lib/vies-workflow.ts). Here the known ones are read back and written in the user's language;
 * anything else is shown as it is.
 */
export function translateWorkflowDescription(description: string): string | null {
  const t = getMessages(workflowMessages).timeline;
  let match: RegExpExecArray | null;

  if ((match = /^Inviata al portale (.+?)(?: \(riferimento (.+)\))?$/.exec(description))) return t.sent(match[1], match[2] ?? null);
  if ((match = /^Presa in carico dal portale (.+) \(riferimento (.+)\)$/.exec(description))) return t.received(match[1], match[2]);
  if ((match = /^Deliberata(?: dalla compagnia)?: bozza da pagare(?: \(([^)]*)\))?((?: · .+)*)$/.exec(description))) {
    let dueDate: string | null = null;
    const notes: string[] = [];
    for (const part of match[2].split(" · ").filter(Boolean)) {
      const due = /^pagamento entro il (\S+)$/.exec(part);
      if (due && !dueDate) dueDate = due[1];
      else notes.push(part);
    }
    return t.deliberated(match[1] ?? null, dueDate, notes.join(" · ") || null);
  }
  if ((match = /^Non deliberata(?: dalla compagnia)?: (.+)$/s.exec(description))) return t.rejected(match[1]);
  if ((match = /^Integrazioni richieste(?: dalla compagnia)?: (.+)$/s.exec(description))) return t.infoRequested(match[1]);
  if ((match = /^Integrazioni (?:inviate alla compagnia|fornite)(?:: (.+))?$/s.exec(description))) return t.infoProvided(match[1] ?? null);
  if ((match = /^Polizza emessa(?:, (\d+) copie)?(?: \((.+)\))?$/.exec(description))) return t.issued(match[2] ?? null, match[1] ? Number(match[1]) : null);
  if ((match = /^Copie firmate trasmesse alla compagnia(?: \((.+)\))?$/.exec(description))) return t.signedSent(match[1] ?? null);
  if ((match = /^Pratica riaperta(?:: (.+))?$/s.exec(description))) return t.reopened(match[1] ?? null);
  if ((match = /^Pagamento registrato \((\S+)\)(?: · (.+))?$/.exec(description))) return t.paid(match[1], match[2] ?? null);
  return null;
}
