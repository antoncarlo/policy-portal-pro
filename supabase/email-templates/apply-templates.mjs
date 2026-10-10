// Applica i modelli email di questa cartella al progetto Supabase tramite la Management API.
// Uso (anteprima, non modifica nulla):   SUPABASE_ACCESS_TOKEN=... node supabase/email-templates/apply-templates.mjs
// Uso (applica davvero):                 SUPABASE_ACCESS_TOKEN=... node supabase/email-templates/apply-templates.mjs --apply
// Il token personale si crea su https://supabase.com/dashboard/account/tokens e va eliminato dopo l'uso.
// Prima di applicare salva una copia dei modelli attuali in supabase/email-templates/backup-<data>.json.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = process.env.PROJECT_REF || "nesblhtjqiavdfsrtfom";
const BASE = process.env.SUPABASE_API_BASE || "https://api.supabase.com";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const APPLY = process.argv.includes("--apply");
if (!TOKEN) { console.error("Manca SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const html = (name) => readFileSync(join(HERE, `${name}.html`), "utf8");
const subjects = {
  "confirm-sign-up": "Conferma il tuo indirizzo email · Confirm your email address · 确认邮箱地址",
  "invite-user": "Invito al portale Tecno Advance MGA · Invitation to the portal · 门户邀请",
  "magic-link": "Il tuo link di accesso · Your sign-in link · 登录链接",
  "change-email-address": "Conferma il nuovo indirizzo email · Confirm your new email address · 确认新邮箱地址",
  "reset-password": "Reimposta la password · Reset your password · 重置密码",
  "reauthentication": "Il tuo codice di verifica · Your verification code · 验证码",
  "password-changed": "La password del tuo account è stata modificata · Your account password was changed · 账号密码已修改",
  "email-changed": "L'email del tuo account è stata modificata · Your account email was changed · 账号邮箱已更改",
};
// file -> chiavi della Management API
const keys = {
  "confirm-sign-up": ["mailer_subjects_confirmation", "mailer_templates_confirmation_content"],
  "invite-user": ["mailer_subjects_invite", "mailer_templates_invite_content"],
  "magic-link": ["mailer_subjects_magic_link", "mailer_templates_magic_link_content"],
  "change-email-address": ["mailer_subjects_email_change", "mailer_templates_email_change_content"],
  "reset-password": ["mailer_subjects_recovery", "mailer_templates_recovery_content"],
  "reauthentication": ["mailer_subjects_reauthentication", "mailer_templates_reauthentication_content"],
  "password-changed": ["mailer_subjects_password_changed_notification", "mailer_templates_password_changed_notification_content"],
  "email-changed": ["mailer_subjects_email_changed_notification", "mailer_templates_email_changed_notification_content"],
};
const payload = { mailer_notifications_password_changed_enabled: true, mailer_notifications_email_changed_enabled: true };
for (const [name, [subjectKey, bodyKey]] of Object.entries(keys)) { payload[subjectKey] = subjects[name]; payload[bodyKey] = html(name); }

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const url = `${BASE}/v1/projects/${REF}/config/auth`;

const current = await fetch(url, { headers });
if (!current.ok) { console.error(`Lettura configurazione non riuscita: ${current.status}`); process.exit(1); }
const config = await current.json();
const backup = Object.fromEntries(Object.entries(config).filter(([k]) => k.startsWith("mailer_")));
console.log(`Progetto ${REF}: ${Object.keys(payload).length} campi da impostare (${Object.keys(keys).length} modelli, 2 notifiche di sicurezza).`);
for (const k of Object.keys(payload)) {
  const same = JSON.stringify(config[k] ?? null) === JSON.stringify(payload[k]);
  console.log(`  ${same ? "= invariato" : "~ cambia    "}  ${k}`);
}
if (!APPLY) { console.log("\nAnteprima: nessuna modifica fatta. Aggiungi --apply per applicare."); process.exit(0); }

const file = join(HERE, `backup-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify(backup, null, 2));
console.log(`\nCopia dei modelli attuali salvata in ${file}`);
const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(payload) });
if (!res.ok) { console.error(`Applicazione non riuscita: ${res.status} ${(await res.text()).slice(0, 300)}`); process.exit(1); }
console.log("Modelli applicati.");
