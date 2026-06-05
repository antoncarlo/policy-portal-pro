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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
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
      const prefix = rawKey.slice(0, 13);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('api_keys').insert({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('api_keys').delete().eq('id', deleteId);
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Chiavi API Partner</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ogni partner esterno deve avere la propria chiave. Non è possibile recuperare una chiave dopo la creazione.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading} className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
            <Plus className="mr-2 h-4 w-4 shrink-0" />
            <span>Nuova Chiave</span>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="w-full overflow-x-auto">
        <Table className="min-w-[980px]">
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
                  <TableCell className="max-w-[220px] break-words font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {key.key_prefix}****
                  </TableCell>
                  <TableCell className="max-w-[260px] break-all text-sm text-muted-foreground">
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
        </div>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Chiave API Generata</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Copia questa chiave ora.</strong> Non sarà più possibile visualizzarla.
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
              <p className="text-sm text-green-600">Copiata negli appunti</p>
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
