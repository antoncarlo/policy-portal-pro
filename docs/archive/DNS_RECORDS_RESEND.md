# DNS RECORDS DA CONFIGURARE PER RESEND

**Dominio**: notifiche.tecnomga.com  
**Data**: 05 Dicembre 2024

---

## ⚠️ IMPORTANTE

Questi record DNS devono essere aggiunti al provider DNS del dominio **tecnomga.com** (es. Aruba, Register.it, GoDaddy, Cloudflare, ecc.)

---

## 1️⃣ DKIM (Domain Verification) - OBBLIGATORIO

**Scopo**: Verifica che sei il proprietario del dominio e autentica le email

| Type | Name | Content | TTL |
|------|------|---------|-----|
| TXT | `resend._domainkey.notifiche` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDcYuliNnPyi97VwGHKff3RFZIJOxwvpbfiXZ7DN7X++eFiDRDqUPNw85IUaQtpZ49GW8RkYWv84v94p702e85AgfiEHAGOCRgODIQE5wK78MhQDPhWRUssIIFvimWbVAvTyYt7uMmYyj/MJIEcD2HvCg1oAx2LUdIHUOSLTMeAOQIDAQAB` | Auto (o 3600) |

---

## 2️⃣ SPF (Enable Sending) - OBBLIGATORIO

**Scopo**: Autorizza Amazon SES a inviare email per conto del tuo dominio

### Record MX
| Type | Name | Content | TTL | Priority |
|------|------|---------|-----|----------|
| MX | `send.notifiche` | `feedback-smtp.us-east-1.amazonses.com` | Auto (o 3600) | 10 |

### Record TXT
| Type | Name | Content | TTL |
|------|------|---------|-----|
| TXT | `send.notifiche` | `v=spf1 include:amazonses.com ~all` | Auto (o 3600) |

---

## 3️⃣ DMARC (Optional) - CONSIGLIATO

**Scopo**: Protegge da spoofing e phishing, migliora deliverability

| Type | Name | Content | TTL |
|------|------|---------|-----|
| TXT | `_dmarc` | `v=DMARC1; p=none;` | Auto (o 3600) |

---

## 4️⃣ MX (Enable Receiving) - OPZIONALE

**Scopo**: Permette di ricevere email su notifiche.tecnomga.com (non necessario per invio)

| Type | Name | Content | TTL | Priority |
|------|------|---------|-----|----------|
| MX | `notifiche` | `inbound-smtp.us-east-1.amazonaws.com` | Auto (o 3600) | 10 |

---

## 📋 RIEPILOGO RECORD DA AGGIUNGERE

### Record Minimi (Solo Invio Email)
1. ✅ **DKIM** (TXT): `resend._domainkey.notifiche.tecnomga.com`
2. ✅ **SPF MX**: `send.notifiche.tecnomga.com`
3. ✅ **SPF TXT**: `send.notifiche.tecnomga.com`
4. ⚠️ **DMARC** (TXT): `_dmarc.tecnomga.com` (consigliato)

### Record Opzionali
5. 🔵 **MX Receiving**: `notifiche.tecnomga.com` (solo se vuoi ricevere email)

---

## 🔧 COME CONFIGURARE

### Passo 1: Accedi al Provider DNS
Accedi al pannello di controllo del provider dove hai registrato **tecnomga.com** (es. Aruba, Register.it, GoDaddy, Cloudflare)

### Passo 2: Vai alla Sezione DNS
Cerca la sezione "DNS Management", "Gestione DNS", "Zone DNS" o simile

### Passo 3: Aggiungi i Record
Per ogni record nella tabella sopra:
1. Clicca "Aggiungi Record" o "Add Record"
2. Seleziona il **Type** (TXT, MX, ecc.)
3. Inserisci il **Name** esattamente come indicato
4. Inserisci il **Content** esattamente come indicato (copia-incolla)
5. Imposta **TTL** su Auto o 3600
6. Per record MX, imposta **Priority** a 10
7. Salva

### Passo 4: Attendi Propagazione
- La propagazione DNS può richiedere da 5 minuti a 48 ore
- Solitamente è completata entro 1-2 ore
- Puoi verificare con tool come https://dnschecker.org

### Passo 5: Verifica su Resend
Torna su Resend e clicca "Verify" per controllare che i record siano configurati correttamente

---

## ⚠️ NOTE IMPORTANTI

### Formato Name dei Record
- Se il provider chiede il nome completo (FQDN), usa: `resend._domainkey.notifiche.tecnomga.com`
- Se il provider aggiunge automaticamente il dominio base, usa solo: `resend._domainkey.notifiche`

**Esempio**:
- ❌ **Sbagliato**: `resend._domainkey.notifiche.tecnomga.com.tecnomga.com`
- ✅ **Corretto**: `resend._domainkey.notifiche.tecnomga.com`

### Record TXT
- Alcuni provider richiedono le virgolette, altri no
- Se non funziona, prova con e senza virgolette
- Il contenuto deve essere esattamente come indicato (copia-incolla)

### Verifica Configurazione
Dopo aver aggiunto i record, verifica con:
```bash
# Verifica DKIM
dig TXT resend._domainkey.notifiche.tecnomga.com

# Verifica SPF TXT
dig TXT send.notifiche.tecnomga.com

# Verifica SPF MX
dig MX send.notifiche.tecnomga.com

# Verifica DMARC
dig TXT _dmarc.tecnomga.com
```

---

## 📞 SUPPORTO

Se hai problemi con la configurazione DNS:
1. Contatta il supporto del tuo provider DNS
2. Consulta la documentazione Resend: https://resend.com/docs/dashboard/domains/introduction
3. Usa il tool di verifica DNS: https://dnschecker.org

---

## ✅ CHECKLIST

- [ ] Accesso al pannello DNS del provider
- [ ] Aggiunto record DKIM (TXT)
- [ ] Aggiunto record SPF MX
- [ ] Aggiunto record SPF TXT
- [ ] Aggiunto record DMARC (consigliato)
- [ ] Atteso propagazione DNS (1-2 ore)
- [ ] Verificato su Resend
- [ ] Dominio verificato ✅

---

**Una volta completata la configurazione DNS, torna su Resend per verificare il dominio e generare l'API Key!**
