// Portals the practices are sent to and that answer back: configured on the server only.

export type ViesPortal = {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  /** Shared secret the portal signs its callbacks with (HMAC-SHA256). Empty: callbacks are not accepted. */
  callbackSecret: string;
  /** Hosts, besides the portal's own, the portal may hand documents out from. */
  documentHosts: string[];
  /** Where this portal is told what happens after the send (payment, integrations, reopening). Empty: the send address. */
  eventsUrl: string;
};

/** Public address of this portal, where external portals send their answers. */
export function getPublicBaseUrl(): string {
  return (process.env.PORTAL_URL?.trim() || 'https://portale.tecnomga.com').replace(/\/+$/, '');
}

/** Hosts a portal may fetch/hand out documents from: its own and the ones listed for it. */
export function portalDocumentHosts(portal: Pick<ViesPortal, 'url' | 'documentHosts'>): string[] {
  const hosts = [...portal.documentHosts];
  try {
    hosts.push(new URL(portal.url).hostname);
  } catch {
    // A portal without a valid address contributes no host.
  }
  return hosts.map((host) => host.toLowerCase());
}

/**
 * External portals the practices can be sent to, configured on the server only:
 * - VIES_PORTALS: JSON list [{"id":"…","name":"…","url":"https://…","apiKeyEnv":"VIES_PORTAL_…_KEY",
 *   "callbackSecretEnv":"VIES_PORTAL_…_CALLBACK_SECRET","documentHosts":["files.example.com"],
 *   "eventsUrl":"https://…"}],
 *   each secret in its own environment variable;
 * - or a single portal with VIES_PORTAL_API_URL, VIES_PORTAL_API_KEY, VIES_PORTAL_NAME
 *   and VIES_PORTAL_CALLBACK_SECRET.
 * A portal without URL or key is not listed. URLs, keys and secrets never reach the browser.
 */
export function readPortalRegistry(): ViesPortal[] {
  const portals: ViesPortal[] = [];
  try {
    const configured = JSON.parse(process.env.VIES_PORTALS ?? '[]') as Array<Record<string, unknown>>;
    for (const entry of Array.isArray(configured) ? configured : []) {
      const id = typeof entry.id === 'string' ? entry.id.trim() : '';
      const keyEnv = typeof entry.apiKeyEnv === 'string' ? entry.apiKeyEnv : '';
      const secretEnv = typeof entry.callbackSecretEnv === 'string' ? entry.callbackSecretEnv : '';
      portals.push({
        id,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : id,
        url: typeof entry.url === 'string' ? entry.url.trim() : '',
        apiKey: keyEnv ? process.env[keyEnv] ?? '' : '',
        callbackSecret: secretEnv ? process.env[secretEnv] ?? '' : '',
        documentHosts: Array.isArray(entry.documentHosts)
          ? entry.documentHosts.filter((host): host is string => typeof host === 'string' && host.trim().length > 0).map((host) => host.trim())
          : [],
        eventsUrl: typeof entry.eventsUrl === 'string' ? entry.eventsUrl.trim() : '',
      });
    }
  } catch {
    // An unreadable VIES_PORTALS lists no portal rather than a wrong one.
  }
  if (process.env.VIES_PORTAL_API_URL && !portals.some((portal) => portal.id === 'default')) {
    portals.push({
      id: 'default',
      name: process.env.VIES_PORTAL_NAME?.trim() || 'Portale VIES',
      url: process.env.VIES_PORTAL_API_URL,
      apiKey: process.env.VIES_PORTAL_API_KEY ?? '',
      callbackSecret: process.env.VIES_PORTAL_CALLBACK_SECRET ?? '',
      documentHosts: [],
      eventsUrl: process.env.VIES_PORTAL_EVENTS_URL?.trim() ?? '',
    });
  }
  return portals;
}

/** Portals a practice can be sent to. */
export function getConfiguredPortals(): ViesPortal[] {
  return readPortalRegistry().filter((portal) => portal.id && portal.url && portal.apiKey);
}
