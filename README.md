# Policy Portal Pro

Portale web per **Tecno Advance MGA Broker SRL**, dedicato alla gestione operativa delle pratiche assicurative, dei clienti, delle scadenze, della reportistica e delle integrazioni API con sistemi esterni.

## Panoramica

**Policy Portal Pro** è un’applicazione React e TypeScript distribuita su Vercel, progettata per centralizzare i flussi di lavoro assicurativi di Tecno Advance MGA. Il portale include moduli per la gestione delle pratiche, l’anagrafica clienti, la consultazione delle attività, l’amministrazione utenti, il monitoraggio API e lo scadenzario operativo.

| Area | Descrizione |
|---|---|
| Pratiche | Gestione delle pratiche assicurative e del relativo stato operativo. |
| Clienti | Consultazione e aggiornamento delle anagrafiche clienti. |
| Scadenzario | Monitoraggio delle scadenze e delle attività collegate alle polizze. |
| Report | Analisi e viste riepilogative per il controllo gestionale. |
| Amministrazione | Gestione utenti, impostazioni, log applicativi e log API. |
| Integrazioni | Endpoint webhook per ricezione e sincronizzazione dati da sistemi esterni. |

## Stack tecnico

Il progetto utilizza **React**, **TypeScript**, **Vite** e **Tailwind CSS** per il frontend. Le funzionalità backend e dati sono integrate con Supabase, mentre la distribuzione pubblica è gestita tramite Vercel.

| Componente | Tecnologia |
|---|---|
| Frontend | React, TypeScript, Vite |
| UI | Tailwind CSS, componenti React |
| Backend e dati | Supabase |
| Deploy | Vercel |
| Package manager operativo | npm |

## Sviluppo locale

Per avviare il progetto in ambiente locale è necessario installare le dipendenze e lanciare il server di sviluppo.

```bash
npm install
npm run dev
```

Per produrre una build di verifica o di rilascio utilizzare il comando seguente.

```bash
npm run build
```

## Branding

Il portale utilizza esclusivamente il branding **Tecno Advance MGA**. I colori principali sono il navy `#103657` e l’oro/bronzo `#ac7e59`. Gli asset browser e PWA si trovano nella directory `public/` e includono `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png` e `icon-512.png`.

## Deploy

Il progetto è pubblicato su Vercel all’indirizzo:

https://policy-portal-pro.vercel.app/

Ogni modifica confermata sul branch principale del repository GitHub viene distribuita secondo la configurazione Vercel associata al progetto.
