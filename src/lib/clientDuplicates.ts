/**
 * Possible duplicates in the client address book. Two clients are linked when they share a tax code, a VAT
 * number or an email address; links chain (A shares an email with B, B a tax code with C: one group of three).
 * An email can be shared by two real people (a family, a shared mailbox), so a group is a suggestion for a
 * person to check, never an automatic merge.
 */

export interface ClientLite {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  tax_code: string | null;
  vat_number: string | null;
  phone: string | null;
  mobile: string | null;
  user_id: string;
  created_at: string;
}

export type DuplicateReason = "tax_code" | "vat_number" | "email";

export interface DuplicateGroup {
  reasons: DuplicateReason[];
  /** Oldest first: the natural one to keep. */
  clients: ClientLite[];
}

const normalise = (reason: DuplicateReason, value: string | null): string | null => {
  const text = (value ?? "").trim();
  if (!text) return null;
  if (reason === "email") return text.toLowerCase();
  return text.replace(/\s+/g, "").toUpperCase();
};

export function findDuplicateGroups(clients: ClientLite[]): DuplicateGroup[] {
  const parent = new Map<string, string>(clients.map((client) => [client.id, client.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression.
    let current = id;
    while (parent.get(current) !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  const seen = new Map<string, { id: string; reason: DuplicateReason }>();
  const linkReasons = new Map<string, Set<DuplicateReason>>();
  for (const client of clients) {
    for (const reason of ["tax_code", "vat_number", "email"] as const) {
      const key = normalise(reason, client[reason]);
      if (!key) continue;
      const bucket = `${reason}:${key}`;
      const first = seen.get(bucket);
      if (first) {
        union(first.id, client.id);
        linkReasons.set(bucket, (linkReasons.get(bucket) ?? new Set()).add(reason));
      } else {
        seen.set(bucket, { id: client.id, reason });
      }
    }
  }

  const members = new Map<string, ClientLite[]>();
  for (const client of clients) members.set(find(client.id), [...(members.get(find(client.id)) ?? []), client]);

  const groups: DuplicateGroup[] = [];
  for (const [root, group] of members) {
    if (group.length < 2) continue;
    const reasons = new Set<DuplicateReason>();
    for (const [bucket, set] of linkReasons) {
      const { id } = seen.get(bucket)!;
      if (find(id) === root) for (const reason of set) reasons.add(reason);
    }
    groups.push({
      reasons: (["tax_code", "vat_number", "email"] as const).filter((reason) => reasons.has(reason)),
      clients: [...group].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)),
    });
  }
  return groups.sort((a, b) => b.clients.length - a.clients.length || (a.clients[0].created_at < b.clients[0].created_at ? -1 : 1));
}

export const clientLabel = (client: Pick<ClientLite, "first_name" | "last_name" | "company_name">) => {
  const person = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
  return client.company_name ? (person ? `${client.company_name} (${person})` : client.company_name) : person;
};
