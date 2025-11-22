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

- **Project ID**: hqhnvmpwqkdjnsuosrpw
- **URL**: https://hqhnvmpwqkdjnsuosrpw.supabase.co

### Schema Database

Il database include le seguenti tabelle principali:

1. **profiles** - Profili utente
2. **user_roles** - Ruoli utente (admin, agente, collaboratore)
3. **practices** - Pratiche assicurative
4. **practice_documents** - Documenti allegati alle pratiche
5. **practice_events** - Eventi e log delle pratiche
6. **notifications** - Notifiche in tempo reale

### Migrazioni

Tutte le migrazioni SQL sono disponibili nella cartella `supabase/migrations/`.

## Deployment su Vercel

### Variabili d'Ambiente

Le seguenti variabili d'ambiente devono essere configurate su Vercel:

```
VITE_SUPABASE_URL=https://hqhnvmpwqkdjnsuosrpw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxaG52bXB3cWtkam5zdW9zcnB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NDI1NjUsImV4cCI6MjA3OTMxODU2NX0.R6LG8isyjauRYYFheADLszNBFICPr0U_ZiNqUqNeQ9Q
VITE_SUPABASE_PROJECT_ID=hqhnvmpwqkdjnsuosrpw
```

### Build Settings

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Framework**: Vite

### Deploy

Il progetto è configurato per il deployment automatico su Vercel tramite integrazione GitHub. Ogni push sul branch `main` triggera un nuovo deployment.

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

## Note

- Il file `.env` contiene le credenziali Supabase per lo sviluppo locale
- Le variabili d'ambiente devono essere configurate anche su Vercel per il deployment in produzione
- Il progetto utilizza Row Level Security (RLS) su Supabase per la sicurezza dei dati
