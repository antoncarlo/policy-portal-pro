# 📚 Quick Reference - Policy Portal Pro

Guida rapida con i comandi e le informazioni più utili per gestire il progetto.

---

## 🚀 Comandi Sviluppo Locale

### Installazione Dipendenze
```bash
npm install
# oppure
pnpm install
```

### Avvio Server di Sviluppo
```bash
npm run dev
# oppure
pnpm dev
```

L'applicazione sarà disponibile su `http://localhost:5173`

### Build per Produzione
```bash
npm run build
# oppure
pnpm build
```

### Preview Build di Produzione
```bash
npm run preview
# oppure
pnpm preview
```

---

## 🔄 Comandi Git

### Clonare il Repository
```bash
gh repo clone antoncarlo/policy-portal-pro
```

### Commit e Push
```bash
git add .
git commit -m "descrizione modifiche"
git push origin main
```

### Verificare Status
```bash
git status
git log --oneline -5
```

---

## 📦 Deploy su Vercel

### Deploy Automatico
Ogni push su `main` triggera automaticamente un deploy su Vercel.

### Deploy Manuale (se necessario)
```bash
vercel --prod
```

### Visualizzare Deployment
```bash
vercel ls
```

---

## 🗄️ Gestione Database Supabase

### Accesso Dashboard
https://supabase.com/dashboard/project/nesblhtjqiavdfsrtfom

### Connessione Locale al Database
```bash
# Installare Supabase CLI
npm install -g supabase

# Login
supabase login

# Link al progetto
supabase link --project-ref nesblhtjqiavdfsrtfom
```

### Creare Nuova Migrazione
```bash
# Creare file di migrazione
supabase migration new nome_migrazione

# Applicare migrazioni
supabase db push
```

### Reset Database Locale (Development)
```bash
supabase db reset
```

---

## 🔍 Debug e Troubleshooting

### Verificare Variabili d'Ambiente
```bash
# Locale
cat .env

# Vercel (tramite dashboard)
# Settings > Environment Variables
```

### Logs Vercel
```bash
# Visualizzare logs in tempo reale
vercel logs --follow

# Logs di un deployment specifico
vercel logs [deployment-url]
```

### Console Browser
```javascript
// Verificare client Supabase
console.log(supabase)

// Verificare sessione utente
const { data: { session } } = await supabase.auth.getSession()
console.log(session)
```

---

## 📊 Monitoraggio

### Vercel Dashboard
- **Overview**: https://vercel.com/anton-carlo-santoros-projects-ef8088b3/policy-portal-pro
- **Deployments**: https://vercel.com/anton-carlo-santoros-projects-ef8088b3/policy-portal-pro/deployments
- **Analytics**: https://vercel.com/anton-carlo-santoros-projects-ef8088b3/policy-portal-pro/analytics

### Supabase Dashboard
- **Database**: https://supabase.com/dashboard/project/nesblhtjqiavdfsrtfom/editor
- **Auth**: https://supabase.com/dashboard/project/nesblhtjqiavdfsrtfom/auth/users
- **Storage**: https://supabase.com/dashboard/project/nesblhtjqiavdfsrtfom/storage/buckets
- **Logs**: https://supabase.com/dashboard/project/nesblhtjqiavdfsrtfom/logs/explorer

---

## 🔐 Sicurezza

### Rotazione Chiavi API
1. Accedere a Supabase Dashboard > Settings > API
2. Generare nuova chiave
3. Aggiornare variabili d'ambiente su Vercel
4. Aggiornare file `.env` locale
5. Redeploy applicazione

### Backup Database
```bash
# Tramite Supabase CLI
supabase db dump -f backup.sql

# Restore
supabase db reset
psql -h db.nesblhtjqiavdfsrtfom.supabase.co -U postgres < backup.sql
```

---

## 🛠️ Comandi Utili

### Verificare Versioni
```bash
node --version
npm --version
git --version
```

### Pulire Cache
```bash
# NPM
npm cache clean --force

# Vercel
vercel env pull .env.local
```

### Reinstallare Dipendenze
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📞 Link Rapidi

| Risorsa | URL |
|---------|-----|
| **App Production** | https://policy-portal-pro.vercel.app |
| **Vercel Dashboard** | https://vercel.com/anton-carlo-santoros-projects-ef8088b3/policy-portal-pro |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/nesblhtjqiavdfsrtfom |
| **GitHub Repository** | https://github.com/antoncarlo/policy-portal-pro |
| **Vercel Docs** | https://vercel.com/docs |
| **Supabase Docs** | https://supabase.com/docs |

---

## 🆘 Problemi Comuni

### L'app non si connette a Supabase
1. Verificare variabili d'ambiente in `.env`
2. Verificare che il progetto Supabase sia attivo
3. Controllare la console del browser per errori

### Deploy fallito su Vercel
1. Controllare build logs nella dashboard Vercel
2. Verificare che tutte le dipendenze siano installate
3. Assicurarsi che non ci siano errori TypeScript

### Errori di autenticazione
1. Verificare che RLS sia configurato correttamente
2. Controllare le policies su Supabase
3. Verificare che l'utente abbia i permessi corretti

---

**Ultima modifica**: 24 Novembre 2024
