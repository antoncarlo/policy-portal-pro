import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { RefreshCw, Save, Trash2 } from 'lucide-react';

interface ApiKeyRow {
  id: string;
  name: string;
  partner_email: string | null;
  is_active: boolean;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface MappingRow {
  id: string;
  api_key_id: string;
  user_id: string;
}

function profileLabel(p: ProfileRow): string {
  const name = p.full_name?.trim() || 'Senza nome';
  return `${name} (${p.email ?? '—'})`;
}

export function ApiKeyMappingSettings() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-key pending selection (api_key_id -> user_id)
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Remove confirm state (api_key_id whose mapping is being deleted)
  const [removeId, setRemoveId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [keysRes, profilesRes, mappingsRes] = await Promise.all([
      sb.from('api_keys').select('id, name, partner_email, is_active').order('created_at', { ascending: false }),
      sb.from('profiles').select('id, full_name, email').order('full_name', { ascending: true }),
      sb.from('api_key_user_mapping').select('id, api_key_id, user_id'),
    ]);

    const error = keysRes.error || profilesRes.error || mappingsRes.error;
    if (error) {
      toast({ variant: 'destructive', title: 'Errore caricamento mappature', description: error.message });
    } else {
      setApiKeys(keysRes.data ?? []);
      setProfiles(profilesRes.data ?? []);
      setMappings(mappingsRes.data ?? []);
      const sel: Record<string, string> = {};
      (mappingsRes.data ?? []).forEach((m: MappingRow) => {
        sel[m.api_key_id] = m.user_id;
      });
      setSelected(sel);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSave = async (apiKeyId: string) => {
    const userId = selected[apiKeyId];
    if (!userId) {
      toast({ variant: 'destructive', description: 'Seleziona un utente prima di salvare.' });
      return;
    }
    setSavingId(apiKeyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('api_key_user_mapping')
      .upsert({ api_key_id: apiKeyId, user_id: userId }, { onConflict: 'api_key_id' });
    if (error) {
      toast({ variant: 'destructive', title: 'Errore salvataggio mappatura', description: error.message });
    } else {
      toast({ description: 'Mappatura salvata.' });
      await loadAll();
    }
    setSavingId(null);
  };

  const handleRemove = async () => {
    if (!removeId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('api_key_user_mapping')
      .delete()
      .eq('api_key_id', removeId);
    if (error) {
      toast({ variant: 'destructive', description: error.message });
    } else {
      toast({ description: 'Mappatura rimossa.' });
      await loadAll();
    }
    setRemoveId(null);
  };

  const mappingByKey = new Map(mappings.map(m => [m.api_key_id, m]));
  const profileById = new Map(profiles.map(p => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Mappatura API → Utente</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Assegna a ogni chiave API l'utente del portale che diventerà proprietario delle pratiche
            ricevute via webhook. Senza mappatura, le pratiche restano assegnate all'utente predefinito.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="w-full overflow-x-auto">
        <Table className="min-w-[920px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nome Chiave</TableHead>
              <TableHead>Email Partner</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Utente Mappato</TableHead>
              <TableHead>Assegna Utente</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : apiKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nessuna chiave API disponibile
                </TableCell>
              </TableRow>
            ) : (
              apiKeys.map(key => {
                const mapping = mappingByKey.get(key.id);
                const mappedProfile = mapping ? profileById.get(mapping.user_id) : undefined;
                return (
                  <TableRow key={key.id}>
                    <TableCell className="max-w-[220px] break-words font-medium">{key.name}</TableCell>
                    <TableCell className="max-w-[240px] break-all text-sm text-muted-foreground">
                      {key.partner_email ?? '—'}
                    </TableCell>
                    <TableCell>
                      {key.is_active
                        ? <Badge className="bg-green-600 text-white">Attiva</Badge>
                        : <Badge variant="secondary">Disattiva</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-sm">
                      {mapping ? (
                        mappedProfile ? (
                          <span className="break-words">
                            {mappedProfile.full_name?.trim() || 'Senza nome'}
                            <span className="block text-xs text-muted-foreground break-all">
                              {mappedProfile.email ?? '—'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Utente sconosciuto</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">Nessuna mappatura</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={selected[key.id] ?? undefined}
                        onValueChange={value => setSelected(prev => ({ ...prev, [key.id]: value }))}
                      >
                        <SelectTrigger className="w-[240px]">
                          <SelectValue placeholder="Seleziona utente" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {profileLabel(p)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Salva mappatura"
                          onClick={() => handleSave(key.id)}
                          disabled={savingId === key.id || !selected[key.id]}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Rimuovi mappatura"
                          onClick={() => setRemoveId(key.id)}
                          disabled={!mapping}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Remove confirm */}
      <AlertDialog open={!!removeId} onOpenChange={open => { if (!open) setRemoveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere la mappatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Le pratiche ricevute con questa chiave API torneranno ad essere assegnate all'utente
              predefinito. Potrai riassegnare un utente in qualsiasi momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
