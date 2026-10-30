-- Documenti da firmare (flusso VIES): bucket dei modelli caricati dagli amministratori.
--
-- I modelli (MUP, set informativo, privacy, antiriciclaggio) stanno in `signing-templates`,
-- sotto `vies/<documento>.pdf`. Li legge ogni utente che ha accesso al portale (per scaricarli,
-- firmarli e ricaricarli nella pratica); li carica, sostituisce o rimuove solo un amministratore.
-- Le copie firmate stanno nel bucket `practice-documents`, nella cartella della pratica, con
-- document_type `mup_firmato`, `set_informativo_firmato`, `privacy_firmata`,
-- `antiriciclaggio_firmato`, `polizza_firmata` (regole di accesso gia' in vigore per quel bucket).
--
-- Il modulo di polizza precompilato per la compagnia, generato alla creazione del lotto, ha ora
-- document_type `modulo_polizza_vies`: il portale lo mostra solo agli amministratori.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signing-templates', 'signing-templates', false, 15728640, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Signed-in users can read signing templates" on storage.objects;
create policy "Signed-in users can read signing templates"
  on storage.objects for select to authenticated
  using (bucket_id = 'signing-templates');

drop policy if exists "Admins can upload signing templates" on storage.objects;
create policy "Admins can upload signing templates"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'signing-templates' and public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "Admins can replace signing templates" on storage.objects;
create policy "Admins can replace signing templates"
  on storage.objects for update to authenticated
  using (bucket_id = 'signing-templates' and public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (bucket_id = 'signing-templates' and public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "Admins can delete signing templates" on storage.objects;
create policy "Admins can delete signing templates"
  on storage.objects for delete to authenticated
  using (bucket_id = 'signing-templates' and public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Le righe storiche del modulo precompilato prendono il nuovo tipo, cosi' il filtro non dipende dal nome.
update public.practice_documents
   set document_type = 'modulo_polizza_vies'
 where document_type is null
   and file_name ~* '^Polizza_VIES_.*\.pdf$';

comment on column public.practice_documents.document_type is
  'Slot documentale della pratica: documenti obbligatori (es. visura_camerale), risposte della compagnia (bozza_deliberata, polizza_emessa), modulo di polizza precompilato per la compagnia (modulo_polizza_vies) e copie firmate (mup_firmato, set_informativo_firmato, privacy_firmata, antiriciclaggio_firmato, polizza_firmata).';
