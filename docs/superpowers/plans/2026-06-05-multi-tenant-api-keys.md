# Multi-Tenant API Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single shared `PORTAL_API_KEY` env var with per-partner API keys stored in Supabase, so each external portal has its own key with optional expiry, and can only access its own practices and documents.

**Architecture:** A new `api_keys` table stores SHA-256 hashes of keys (never the plaintext). The webhook and new GET-documents endpoint look up the incoming key hash in this table, check `is_active` and `expires_at`, and tag every practice/log with `api_key_id`. The admin UI in Settings lets admins create, rotate, and deactivate keys — the raw key is shown exactly once at creation time.

**Tech Stack:** TypeScript, Vercel Node.js serverless, Supabase (PostgreSQL + RLS + Storage), React + shadcn/ui, Web Crypto API (SubtleCrypto) for client-side SHA-256.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260605_multi_tenant_api_keys.sql` | `api_keys` table, FK columns on practices + api_logs, RLS |
| Modify | `api/webhook-receive-policy.ts` | Validate key against DB, store api_key_id |
| Create | `api/get-practice-documents.ts` | GET endpoint returning signed URLs, filtered by api_key_id |
| Create | `src/components/settings/admin/ApiKeysSettings.tsx` | Admin UI: list, create, rotate, deactivate keys |
| Modify | `src/pages/Settings.tsx` | Add "Chiavi API" tab (admin only) |
| Modify | `src/pages/ApiDocs.tsx` | Document GET endpoint + updated auth section |

---

## Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/20260605_multi_tenant_api_keys.sql`

- [ ] **Step 1: Write the migration**

```sql
-- api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  partner_email text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage api_keys" ON public.api_keys
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON public.api_keys(is_active);

-- Add api_key_id to practices
ALTER TABLE public.practices
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_practices_api_key_id ON public.practices(api_key_id);

-- Add api_key_id to api_logs
ALTER TABLE public.api_logs
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Apply migration in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run the migration.
Verify: `SELECT * FROM public.api_keys LIMIT 1;` returns empty (no error).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260605_multi_tenant_api_keys.sql
git commit -m "feat: add api_keys table with multi-tenant support"
```

---

## Task 2: Update webhook to validate against DB

**Files:**
- Modify: `api/webhook-receive-policy.ts`

The current webhook validates `X-API-Key` using `crypto.timingSafeEqual` against `process.env.PORTAL_API_KEY`. Replace this with a DB lookup.

Key format the system will generate: `tmga_` + 32 lowercase hex chars (e.g. `tmga_a1b2c3d4e5f6...`).
Hash stored in DB: `SHA-256(rawKey)` as lowercase hex string (64 chars).

- [ ] **Step 1: Replace the API key validation block**

In `api/webhook-receive-policy.ts`, find and replace the entire "4. API Key" section:

**OLD code (lines ~130–145 approximately):**
```typescript
// 4. API Key
const portalApiKey = process.env.PORTAL_API_KEY;
if (!portalApiKey || !apiKey) {
  return logAndRespond(401, { error: 'X-API-Key header mancante.' });
}
const expectedKeyBuf = Buffer.from(portalApiKey, 'utf8');
const providedKeyBuf = Buffer.from(apiKey, 'utf8');
if (
  expectedKeyBuf.length !== providedKeyBuf.length ||
  !crypto.timingSafeEqual(expectedKeyBuf, providedKeyBuf)
) {
  return logAndRespond(401, { error: 'API Key non valida.' }, { error_message: 'Invalid API key' });
}
```

**NEW code — replace the entire block with:**
```typescript
// 4. API Key — validate against api_keys table
if (!apiKey) {
  return logAndRespond(401, { error: 'X-API-Key header mancante.' });
}

const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
const { data: keyRecord, error: keyError } = await supabaseAdmin
  .from('api_keys')
  .select('id, is_active, expires_at')
  .eq('key_hash', keyHash)
  .maybeSingle();

// Fallback: accept legacy PORTAL_API_KEY env var if no DB keys exist yet
const legacyKey = process.env.PORTAL_API_KEY;
const legacyMatch = legacyKey
  ? (() => {
      const a = Buffer.from(legacyKey, 'utf8');
      const b = Buffer.from(apiKey, 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    })()
  : false;

if (!keyRecord && !legacyMatch) {
  return logAndRespond(401, { error: 'API Key non valida.' }, { error_message: 'Key not found in DB' });
}

if (keyRecord) {
  if (!keyRecord.is_active) {
    return logAndRespond(401, { error: 'API Key disattivata.' }, { error_message: 'Key inactive' });
  }
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return logAndRespond(401, { error: 'API Key scaduta.' }, { error_message: 'Key expired' });
  }
  // Update last_used_at (fire-and-forget)
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(() => {});
}
```

- [ ] **Step 2: Store `api_key_id` on practice insert**

In the same file, find the practice insert block (around `supabaseAdmin.from('practices').insert({...})`). Add `api_key_id` to the insert object:

```typescript
const { data: practice, error: practiceError } = await supabaseAdmin
  .from('practices')
  .insert({
    // ... existing fields ...
    api_key_id: keyRecord?.id ?? null,   // ← add this line
  })
  .select('id, practice_number')
  .single();
```

- [ ] **Step 3: Store `api_key_id` on log entries**

In the `logRequest` helper function signature and body, add `api_key_id?: string` to the data parameter type and pass it through:

```typescript
async function logRequest(
  supabaseAdmin: ReturnType<typeof createClient>,
  data: {
    api_key_masked: string;
    source: string;
    ip_address: string;
    endpoint: string;
    method: string;
    status_code: number;
    practice_id?: string;
    error_message?: string;
    request_body_size: number;
    api_key_id?: string;   // ← add this
  }
): Promise<void>
```

Pass `api_key_id: keyRecord?.id` in both the success and error `logRequest` calls at the bottom of the handler.

- [ ] **Step 4: Build check**

```bash
cd path/to/worktree && node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add api/webhook-receive-policy.ts
git commit -m "feat: validate webhook API key against api_keys DB table with legacy fallback"
```

---

## Task 3: New GET /api/get-practice-documents endpoint

**Files:**
- Create: `api/get-practice-documents.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

// In-memory rate limiter (shared module-level state across warm invocations)
interface RateLimitEntry { count: number; windowStart: number; }
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non consentito. Utilizzare GET.' });

  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
    'unknown'
  );

  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({ error: 'Troppe richieste.', retry_after: retryAfter });
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) return res.status(401).json({ error: 'X-API-Key header mancante.' });

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Validate API key against DB
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const { data: keyRecord } = await supabaseAdmin
    .from('api_keys')
    .select('id, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  // Legacy fallback
  const legacyKey = process.env.PORTAL_API_KEY;
  const legacyMatch = legacyKey
    ? (() => {
        const a = Buffer.from(legacyKey, 'utf8');
        const b = Buffer.from(apiKey, 'utf8');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      })()
    : false;

  if (!keyRecord && !legacyMatch) return res.status(401).json({ error: 'API Key non valida.' });
  if (keyRecord && !keyRecord.is_active) return res.status(401).json({ error: 'API Key disattivata.' });
  if (keyRecord?.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return res.status(401).json({ error: 'API Key scaduta.' });
  }

  // Update last_used_at
  if (keyRecord) {
    supabaseAdmin.from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)
      .then(() => {});
  }

  // Resolve practice
  const { practice_id, practice_number } = req.query as Record<string, string>;
  if (!practice_id && !practice_number) {
    return res.status(422).json({ error: 'Fornire practice_id o practice_number come query param.' });
  }

  let practiceQuery = supabaseAdmin
    .from('practices')
    .select('id, practice_number, api_key_id');

  if (practice_id) {
    practiceQuery = practiceQuery.eq('id', practice_id);
  } else {
    practiceQuery = practiceQuery.eq('practice_number', practice_number);
  }

  const { data: practice } = await practiceQuery.maybeSingle();

  if (!practice) return res.status(404).json({ error: 'Pratica non trovata.' });

  // Tenant isolation: if key is in DB, practice must belong to that key
  if (keyRecord && practice.api_key_id !== keyRecord.id) {
    return res.status(403).json({ error: 'Accesso negato: questa pratica non appartiene alla tua chiave API.' });
  }

  // Get documents
  const { data: docs, error: docsError } = await supabaseAdmin
    .from('practice_documents')
    .select('id, file_name, file_path, file_size, mime_type, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: false });

  if (docsError) return res.status(500).json({ error: 'Errore caricamento documenti.' });

  // Generate signed URLs
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();

  const documentsWithUrls = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await supabaseAdmin.storage
        .from('practice-documents')
        .createSignedUrl(doc.file_path, SIGNED_URL_EXPIRY_SECONDS);

      return {
        id: doc.id,
        file_name: doc.file_name,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        created_at: doc.created_at,
        download_url: signed?.signedUrl ?? null,
        expires_at: expiresAt,
      };
    })
  );

  return res.status(200).json({
    practice_id: practice.id,
    practice_number: practice.practice_number,
    documents: documentsWithUrls,
  });
}
```

- [ ] **Step 2: Build check**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/get-practice-documents.ts
git commit -m "feat: add GET /api/get-practice-documents endpoint with tenant isolation"
```

---

## Task 4: ApiKeysSettings.tsx — Admin UI

**Files:**
- Create: `src/components/settings/admin/ApiKeysSettings.tsx`

The component lets admins CRUD API keys. Key generation happens client-side using `crypto.randomUUID()`. Hashing uses `crypto.subtle.digest` (Web Crypto — available in all modern browsers). The raw key is shown **once** in a dialog and never stored.

Key format: `tmga_` + UUID without dashes (e.g. `tmga_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`).
Key prefix stored: first 13 chars (e.g. `tmga_a1b2c3d4`).

- [ ] **Step 1: Create the component**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Copy, Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  partner_email: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

async function hashKey(rawKey: string): Promise<string> {
  const encoded = new TextEncoder().encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRawKey(): string {
  return 'tmga_' + crypto.randomUUID().replace(/-/g, '');
}

export function ApiKeysSettings() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);

  // Show-key dialog state
  const [showKeyOpen, setShowKeyOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, partner_email, is_active, expires_at, created_at, last_used_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Errore caricamento chiavi', description: error.message });
    } else {
      setKeys(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ variant: 'destructive', description: 'Il nome è obbligatorio.' });
      return;
    }
    setCreating(true);
    try {
      const rawKey = generateRawKey();
      const hash = await hashKey(rawKey);
      const prefix = rawKey.slice(0, 13); // "tmga_" + 8 chars

      const { error } = await supabase.from('api_keys').insert({
        name: newName.trim(),
        key_hash: hash,
        key_prefix: prefix,
        partner_email: newEmail.trim() || null,
        expires_at: newExpiresAt || null,
        created_by: currentUserId,
        is_active: true,
      });

      if (error) throw error;

      setGeneratedKey(rawKey);
      setKeyCopied(false);
      setCreateOpen(false);
      setNewName('');
      setNewEmail('');
      setNewExpiresAt('');
      setShowKeyOpen(true);
      await loadKeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
      toast({ variant: 'destructive', title: 'Errore creazione chiave', description: msg });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (key: ApiKey) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: !key.is_active })
      .eq('id', key.id);
    if (error) {
      toast({ variant: 'destructive', description: error.message });
    } else {
      toast({ description: key.is_active ? 'Chiave disattivata.' : 'Chiave attivata.' });
      await loadKeys();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('api_keys').delete().eq('id', deleteId);
    if (error) {
      toast({ variant: 'destructive', description: error.message });
    } else {
      toast({ description: 'Chiave eliminata.' });
      await loadKeys();
    }
    setDeleteId(null);
  };

  const handleRotate = async (key: ApiKey) => {
    if (!confirm(`Ruotare la chiave "${key.name}"? La chiave attuale verrà invalidata immediatamente.`)) return;
    try {
      const rawKey = generateRawKey();
      const hash = await hashKey(rawKey);
      const prefix = rawKey.slice(0, 13);

      const { error } = await supabase
        .from('api_keys')
        .update({ key_hash: hash, key_prefix: prefix, last_used_at: null })
        .eq('id', key.id);

      if (error) throw error;

      setGeneratedKey(rawKey);
      setKeyCopied(false);
      setShowKeyOpen(true);
      await loadKeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
      toast({ variant: 'destructive', title: 'Errore rotazione', description: msg });
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setKeyCopied(true);
    toast({ description: 'Chiave copiata negli appunti.' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Chiavi API Partner</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ogni partner esterno deve avere la propria chiave. Non è possibile recuperare una chiave dopo la creazione.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuova Chiave
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome Partner</TableHead>
              <TableHead>Prefisso Chiave</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead>Ultimo Utilizzo</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nessuna chiave API creata
                </TableCell>
              </TableRow>
            ) : (
              keys.map(key => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {key.key_prefix}****
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.partner_email ?? '—'}
                  </TableCell>
                  <TableCell>
                    {key.is_active
                      ? <Badge className="bg-green-600 text-white">Attiva</Badge>
                      : <Badge variant="secondary">Disattiva</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-sm">
                    {key.expires_at
                      ? new Date(key.expires_at).toLocaleDateString('it-IT')
                      : <span className="text-muted-foreground">Mai</span>
                    }
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleString('it-IT')
                      : '—'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title={key.is_active ? 'Disattiva' : 'Attiva'}
                        onClick={() => handleToggleActive(key)}
                      >
                        {key.is_active
                          ? <ToggleRight className="h-4 w-4 text-green-600" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ruota chiave"
                        onClick={() => handleRotate(key)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Elimina"
                        onClick={() => setDeleteId(key.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea Nuova Chiave API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome Partner *</Label>
              <Input
                placeholder="es. Portale Agente XYZ"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Email Partner</Label>
              <Input
                type="email"
                placeholder="partner@example.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Scadenza (opzionale)</Label>
              <Input
                type="date"
                value={newExpiresAt}
                onChange={e => setNewExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creazione...' : 'Crea Chiave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show key once dialog */}
      <Dialog open={showKeyOpen} onOpenChange={(open) => { if (!open) setShowKeyOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chiave API Generata</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ <strong>Copia questa chiave ora.</strong> Non sarà più possibile visualizzarla.
            </div>
            <div className="flex gap-2">
              <Input
                value={generatedKey}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="sm" onClick={copyKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {keyCopied && (
              <p className="text-sm text-green-600">✓ Copiata negli appunti</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowKeyOpen(false)}>Ho salvato la chiave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la chiave?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione è irreversibile. I partner che usano questa chiave non potranno più accedere.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/admin/ApiKeysSettings.tsx
git commit -m "feat: add ApiKeysSettings admin component for multi-tenant key management"
```

---

## Task 5: Wire new tab in Settings.tsx

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Add import**

Add to the imports block:
```typescript
import { ApiKeysSettings } from "@/components/settings/admin/ApiKeysSettings";
```

And add `Key` to the lucide-react import:
```typescript
import { User, Lock, Settings2, Users, FileText, Shield, BarChart3, Activity, Database, Mail, Monitor, Webhook, Key } from "lucide-react";
```

- [ ] **Step 2: Add TabsTrigger** (inside the `{showAdminTabs && (...)}` block, after the API Logs trigger)

```tsx
<TabsTrigger value="api-keys" className="flex items-center gap-2">
  <Key className="h-4 w-4" />
  <span className="hidden sm:inline">Chiavi API</span>
</TabsTrigger>
```

Update `grid-cols-13` → `grid-cols-14` in the TabsList className.

- [ ] **Step 3: Add TabsContent** (inside `{showAdminTabs && (...)}`, after the API Logs content)

```tsx
<TabsContent value="api-keys" className="space-y-4">
  <ApiKeysSettings />
</TabsContent>
```

- [ ] **Step 4: Build check**

```bash
node_modules/.bin/vite build 2>&1 | tail -5
```

Expected: `✓ built in ...`

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add Chiavi API tab to Settings admin section"
```

---

## Task 6: Update ApiDocs.tsx

**Files:**
- Modify: `src/pages/ApiDocs.tsx`

- [ ] **Step 1: Update authentication section**

In the `/* 2. Autenticazione */` section, after the existing headers table, add:

```tsx
<div style={styles.infoBox}>
  Ogni partner riceve una chiave univoca. Le chiavi vengono create dall&apos;amministratore in{' '}
  <strong>Impostazioni → Chiavi API</strong>. Non è possibile recuperare una chiave dopo la creazione.
</div>
```

- [ ] **Step 2: Add new endpoint section**

After the existing `POST /api/webhook-receive-policy` endpoint section, add a new subsection:

```tsx
<h3 style={styles.h3}>GET /api/get-practice-documents</h3>
<p style={styles.p}>
  Recupera i documenti allegati a una pratica creata con la propria chiave API.
  I link di download sono URL firmati con scadenza di <strong>1 ora</strong>.
</p>

<table style={styles.table}>
  <thead>
    <tr>
      <th style={styles.th}>Query Param</th>
      <th style={styles.th}>Obbligatorio</th>
      <th style={styles.th}>Descrizione</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style={styles.td}><code style={styles.inlineCode}>practice_id</code></td>
      <td style={styles.td}><span style={styles.badge('#d97706')}>uno dei due</span></td>
      <td style={styles.td}>UUID della pratica</td>
    </tr>
    <tr>
      <td style={styles.tdAlt}><code style={styles.inlineCode}>practice_number</code></td>
      <td style={styles.tdAlt}><span style={styles.badge('#d97706')}>uno dei due</span></td>
      <td style={styles.tdAlt}>Numero pratica (es. PR-2026-1234)</td>
    </tr>
  </tbody>
</table>

<h3 style={styles.h3}>Esempio risposta GET documenti</h3>
<pre style={styles.code}>{`GET /api/get-practice-documents?practice_id=550e8400-e29b-41d4-a716-446655440000
X-API-Key: tmga_a1b2c3d4...

{
  "practice_id": "550e8400-e29b-41d4-a716-446655440000",
  "practice_number": "PR-2026-1234",
  "documents": [
    {
      "id": "...",
      "file_name": "preventivo_o_contratto.pdf",
      "file_size": 204800,
      "mime_type": "application/pdf",
      "created_at": "2026-06-05T10:00:00Z",
      "download_url": "https://xxx.supabase.co/storage/v1/...",
      "expires_at": "2026-06-05T11:00:00Z"
    }
  ]
}`}</pre>
```

- [ ] **Step 3: Build check and commit**

```bash
node_modules/.bin/vite build 2>&1 | tail -5
git add src/pages/ApiDocs.tsx
git commit -m "docs: update ApiDocs with multi-tenant auth info and GET documents endpoint"
```

---

## Self-Review

**Spec coverage:**
- ✅ `api_keys` table with hash, prefix, is_active, expires_at, last_used_at — Task 1
- ✅ Webhook validates against DB — Task 2
- ✅ Legacy fallback during migration — Task 2
- ✅ `api_key_id` stored on practices — Task 2
- ✅ `api_key_id` stored on api_logs — Task 2 (logRequest signature update)
- ✅ GET endpoint with tenant isolation — Task 3
- ✅ Signed URLs 1 hour expiry — Task 3
- ✅ Admin UI: list, create, toggle, delete, rotate — Task 4
- ✅ Key shown once at creation — Task 4
- ✅ Settings tab wired — Task 5
- ✅ ApiDocs updated — Task 6

**Type consistency check:**
- `ApiKey` interface in Task 4 matches `api_keys` table columns from Task 1 ✅
- `keyRecord.id` used consistently in Tasks 2 and 3 ✅
- `hashKey()` function uses same SHA-256 algorithm as server-side `crypto.createHash('sha256')` ✅
- `key_prefix` = first 13 chars (`tmga_` + 8) — consistent across Tasks 1, 4 ✅

**No placeholders found.**
