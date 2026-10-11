# Policy Portal Pro - Deployment Guide

## Progetto

Policy Portal Pro è un'applicazione web per la gestione di pratiche assicurative con sistema di autenticazione e ruoli (Admin, Agente, Collaboratore).

## Stack Tecnologico

- **Frontend**: React + Vite + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel

## Database Supabase

Il progetto utilizza Supabase come backend con le seguenti configurazioni:

- **Project ID**: nesblhtjqiavdfsrtfom
- **URL**: https://nesblhtjqiavdfsrtfom.supabase.co
- **Region**: EU-West-1

### Schema Database

Il database include le seguenti tabelle principali:

1. **profiles** - Profili utente
2. **user_roles** - Ruoli utente (admin, agente, collaboratore)
3. **practices** - Pratiche assicurative
4. **practice_documents** - Documenti allegati alle pratiche
5. **practice_events** - Eventi e log delle pratiche
6. **notifications** - Notifiche in tempo reale

### Storage

- **Bucket**: practice-documents (privato con RLS)

### Migrazioni

Tutte le migrazioni SQL sono disponibili nella cartella `supabase/migrations/`.

Le seguenti migrazioni sono state applicate:
- `20251122152637_create_profiles_and_roles`
- `20251122152646_fix_handle_updated_at`
- `20251122152656_create_practices_table`
- `20251122152705_generate_practice_number`
- `20251122152714_create_documents_and_events`
- `20251122152723_create_notifications`
- `20251122152919_fix_get_practice_id_from_path_security`
- `20251124130900_performance_optimization` (indici e ottimizzazione RLS)

## Deployment su Vercel

### Variabili d'Ambiente

Le seguenti variabili d'ambiente devono essere configurate su Vercel:

```
VITE_SUPABASE_URL=https://nesblhtjqiavdfsrtfom.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lc2JsaHRqcWlhdmRmc3J0Zm9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTg1NjAsImV4cCI6MjA3OTM5NDU2MH0.AiR8xfkVBwx7nVcVCpXpMvdlvhskye_WPZoA62D2_kw
VITE_SUPABASE_PROJECT_ID=nesblhtjqiavdfsrtfom
```

### Build Settings

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Framework**: Vite
- **Node Version**: 22.x

### Deploy

Il progetto è configurato per il deployment automatico su Vercel tramite integrazione GitHub. Ogni push sul branch `main` triggera un nuovo deployment.

**Project ID Vercel**: prj_amB1jHfoNYrawebzfhGPE6aKWZSp
**Team ID Vercel**: team_tdYF2Vfdj3314n0DjA4vDjZ7

## Sviluppo Locale

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev

# Build per produzione
npm run build

# Preview build
npm run preview
```

## Ottimizzazioni Applicate

### Performance Database
- ✅ Indici aggiunti su tutte le foreign key
- ✅ RLS policies ottimizzate con `(SELECT auth.uid())`
- ✅ Indici su colonne frequentemente interrogate (status, created_at)

### Sicurezza
- ✅ Row Level Security (RLS) abilitato su tutte le tabelle
- ✅ Storage bucket privato con policy RLS
- ✅ Funzioni SECURITY DEFINER per prevenire ricorsione RLS
- ✅ Nessun problema di sicurezza rilevato dagli advisor Supabase

## Note

- Il file `.env` contiene le credenziali Supabase per lo sviluppo locale
- Il file `.env.production` contiene le credenziali per la produzione
- Le variabili d'ambiente devono essere configurate anche su Vercel per il deployment in produzione
- Il progetto utilizza Row Level Security (RLS) su Supabase per la sicurezza dei dati
