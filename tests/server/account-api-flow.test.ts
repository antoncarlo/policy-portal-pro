/* eslint-disable @typescript-eslint/no-explicit-any -- scenario code written against loosely typed doubles */
import http from "node:http";
import net from "node:net";
import { afterAll } from "vitest";
import { suite } from "../helpers/suite";

const SB_PORT = 54331, SMTP_PORT = 52525;
const mails: { to: string; data: string }[] = [];
const hits: Record<string, number> = {};
const adminPuts: any[] = []; const created: any[] = []; const upserts: Record<string, any[]> = {};

// ---------- SMTP sink ----------
const smtpSink = net.createServer((sock) => {
  let inData = false, buf = "", rcpt = "";
  sock.write("220 sink ESMTP\r\n");
  sock.on("data", (chunk) => {
    buf += chunk.toString();
    while (true) {
      if (inData) {
        const end = buf.indexOf("\r\n.\r\n");
        if (end < 0) return;
        mails.push({ to: rcpt, data: buf.slice(0, end) }); buf = buf.slice(end + 5); inData = false; sock.write("250 queued\r\n"); continue;
      }
      const nl = buf.indexOf("\r\n"); if (nl < 0) return;
      const line = buf.slice(0, nl); buf = buf.slice(nl + 2);
      const cmd = line.toUpperCase();
      if (cmd.startsWith("EHLO")) sock.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
      else if (cmd.startsWith("AUTH PLAIN")) sock.write("235 ok\r\n");
      else if (cmd.startsWith("AUTH LOGIN")) { sock.write("334 VXNlcm5hbWU6\r\n"); }
      else if (cmd.startsWith("MAIL FROM")) sock.write("250 ok\r\n");
      else if (cmd.startsWith("RCPT TO")) { rcpt = line.slice(line.indexOf("<") + 1, line.indexOf(">")); sock.write("250 ok\r\n"); }
      else if (cmd === "DATA") { inData = true; sock.write("354 go\r\n"); }
      else if (cmd === "QUIT") { sock.write("221 bye\r\n"); sock.end(); }
      else if (/^[A-Za-z0-9+/=]+$/.test(line)) { sock.write(line.length > 0 ? "334 UGFzc3dvcmQ6\r\n" : "235 ok\r\n"); }
      else sock.write("250 ok\r\n");
    }
  });
}).listen(SMTP_PORT);

// ---------- fake Supabase ----------
const users: Record<string, any> = {
  "tok-admin": { id: "44444444-4444-4444-8444-444444444444", email: "admin@x.com", app_metadata: {}, last_sign_in_at: "2026-01-01" },
  "tok-user": { id: "11111111-1111-4111-8111-111111111111", email: "user@x.com", app_metadata: { must_change_password: true }, last_sign_in_at: "2026-01-01" },
};
const byId: Record<string, any> = {
  "22222222-2222-4222-8222-222222222222": { id: "22222222-2222-4222-8222-222222222222", email: "new@x.com", last_sign_in_at: null, app_metadata: {} },
  "33333333-3333-4333-8333-333333333333": { id: "33333333-3333-4333-8333-333333333333", email: "old@x.com", last_sign_in_at: "2026-02-02", app_metadata: {} },
};
const nowIso = new Date().toISOString();
const json = (res: http.ServerResponse, status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const supabaseStub = http.createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url!, "http://x"); const body = raw ? JSON.parse(raw) : {};
    const p = url.pathname;
    const bearer = (req.headers.authorization || "").replace("Bearer ", "");
    if (p === "/auth/v1/user") { const u = users[bearer]; return u ? json(res, 200, { ...u, aud: "authenticated" }) : json(res, 401, { msg: "bad jwt" }); }
    if (p === "/rest/v1/rpc/auth_user_for_email") {
      const e = body.p_email;
      if (e === "exists@x.com") return json(res, 200, [{ id: "ex1", banned: false, recovery_sent_at: null, last_sign_in_at: "2026-01-01" }]);
      if (e === "banned@x.com") return json(res, 200, [{ id: "ban1", banned: true, recovery_sent_at: null, last_sign_in_at: null }]);
      if (e === "recent@x.com") return json(res, 200, [{ id: "rec1", banned: false, recovery_sent_at: new Date().toISOString(), last_sign_in_at: null }]);
      return json(res, 200, []);
    }
    if (p === "/rest/v1/rpc/mfa_required_for_user") return json(res, 200, false);
    if (p === "/rest/v1/email_suppressions" && req.method === "GET") return json(res, 200, []);
    if (p === "/rest/v1/rpc/rate_limit_hit") {
      hits[body.p_bucket] = (hits[body.p_bucket] ?? 0) + 1;
      const allowed = hits[body.p_bucket] <= body.p_limit;
      return json(res, 200, [{ allowed, retry_after: allowed ? 0 : 30, hits: hits[body.p_bucket] }]);
    }
    if (p === "/rest/v1/profiles" && req.method === "GET") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      const row = id === "ex1" ? { full_name: "Mario Rossi", language: "zh" } : id === "22222222-2222-4222-8222-222222222222" ? { full_name: "Nuovo Utente", language: "en" } : { full_name: "Vecchio", language: "it" };
      return json(res, 200, row);
    }
    if (p === "/rest/v1/user_roles" && req.method === "GET") return bearer === "svc" && url.searchParams.get("user_id")?.includes("44444444-4444-4444-8444-444444444444") ? json(res, 200, { role: "admin" }) : json(res, 200, null);
    if (req.method === "POST" && p.startsWith("/rest/v1/")) { (upserts[p] ||= []).push(body); return json(res, 201, null); }
    if (p === "/auth/v1/admin/generate_link") return json(res, 200, { id: "x", email: body.email, action_link: "https://sb/verify?token=abc", email_otp: "123456", hashed_token: "HASH-" + body.email, redirect_to: "", verification_type: "recovery" });
    if (p === "/auth/v1/admin/users" && req.method === "POST") { created.push(body); return json(res, 200, { id: "22222222-2222-4222-8222-222222222222", email: body.email, app_metadata: { provider: "email", ...(body.app_metadata || {}) }, user_metadata: body.user_metadata }); }
    if (p.startsWith("/auth/v1/admin/users/") && req.method === "PUT") { adminPuts.push({ id: p.split("/").pop(), body }); return json(res, 200, { id: p.split("/").pop() }); }
    if (p.startsWith("/auth/v1/admin/users/") && req.method === "GET") { const u = byId[p.split("/").pop()!]; return u ? json(res, 200, u) : json(res, 404, { msg: "not found" }); }
    if (p === "/auth/v1/token") { return body.password === "TempPass123456" ? json(res, 200, { access_token: "a.b.c", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "11111111-1111-4111-8111-111111111111", email: body.email } }) : json(res, 400, { error: "invalid_grant", error_code: "invalid_credentials", msg: "Invalid login credentials" }); }
    if (p === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
    json(res, 404, { msg: "no route " + p });
  });
}).listen(SB_PORT);

Object.assign(process.env, {
  SUPABASE_URL: `http://127.0.0.1:${SB_PORT}`, SUPABASE_SERVICE_ROLE_KEY: "svc", SUPABASE_ANON_KEY: "anon",
  GMAIL_USER: "portale@tecnomga.com", GMAIL_APP_PASSWORD: "pw", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(SMTP_PORT),
  PORTAL_URL: "https://portale.tecnomga.com",
});

const { check, report } = suite();

const call = async (handler: any, body: any, headers: Record<string, string> = {}, ip = "1.1.1.1") => {
  let status = 0, payload: any = null; const hdrs: Record<string, string> = {};
  const res: any = { setHeader: (k: string, v: string) => (hdrs[k] = v), status(n: number) { status = n; return res; }, json(b: any) { payload = b; return res; } };
  const t0 = Date.now();
  await handler({ method: "POST", headers: { "x-forwarded-for": ip, ...headers }, body, socket: {} }, res);
  return { status, payload, ms: Date.now() - t0, hdrs };
};
const waitMail = async (n: number) => { for (let i = 0; i < 40 && mails.length < n; i++) await new Promise((r) => setTimeout(r, 100)); };
const decode = (m: { data: string }) => { // quoted-printable / base64 bodies
  const text = m.data; const b64 = text.match(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*)$/i);
  return b64 ? Buffer.from(b64[1].replace(/\s+/g, ""), "base64").toString("utf8") : text.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
};

const reset = (await import("../../api/password-reset")).default;
const actions = (await import("../../api/portal-actions")).default;

// ===== password-reset =====
let r = await call(reset, { email: "exists@x.com", language: "it" }, {}, "10.0.0.1");
check("reset: indirizzo esistente -> ok:true", r.status === 200 && r.payload?.ok === true);
check("reset: risposta non prima di 1,5 s", r.ms >= 1450, `${r.ms} ms`);
await waitMail(1);
check("reset: una email partita", mails.length === 1 && mails[0].to === "exists@x.com", `mail=${mails.length}`);
let body = mails[0] ? decode(mails[0]) : "";
check("reset: email in cinese (lingua del profilo)", /重置密码/.test(body) || /=E9=87=8D/.test(mails[0]?.data ?? "") || /5Yet/.test(mails[0]?.data ?? ""), "");
check("reset: link con token_hash e kind=recovery", /token_hash=HASH-exists%40x\.com&(amp;)?type=recovery&(amp;)?kind=recovery/.test(body), body.match(/reset-password\?[^"<\s]*/)?.[0] ?? "link non trovato");
check("reset: link su portale.tecnomga.com", body.includes("https://portale.tecnomga.com/reset-password?"));

const before = mails.length;
r = await call(reset, { email: "nobody@x.com" }, {}, "10.0.0.2");
check("reset: indirizzo inesistente -> stessa risposta ok:true", r.status === 200 && r.payload?.ok === true);
check("reset: inesistente, stesso tempo minimo", r.ms >= 1450, `${r.ms} ms`);
r = await call(reset, { email: "banned@x.com" }, {}, "10.0.0.3");
check("reset: account disattivato -> ok:true senza email", r.payload?.ok === true);
r = await call(reset, { email: "recent@x.com" }, {}, "10.0.0.4");
check("reset: richiesta recente -> ok:true senza email", r.payload?.ok === true);
await new Promise((r2) => setTimeout(r2, 500));
check("reset: nessuna email extra (inesistente, disattivato, recente)", mails.length === before, `mail=${mails.length - before}`);
r = await call(reset, { email: "non-una-email" }, {}, "10.0.0.5");
check("reset: email malformata -> 400", r.status === 400);
r = await call(reset, {}, {}, "10.0.0.6");
check("reset: senza email -> 400", r.status === 400);
const burst: number[] = [];
for (let i = 0; i < 7; i++) burst.push((await call(reset, { email: "nobody@x.com" }, {}, "10.9.9.9")).status);
check("reset: dopo 5 richieste dallo stesso IP -> 429", burst.slice(0, 5).every((s) => s === 200) && burst[5] === 429 && burst[6] === 429, burst.join(","));
// the same address asked for from many places: only the first three an hour send an email
const beforeAddress = mails.length;
for (let i = 0; i < 4; i++) await call(reset, { email: "exists@x.com", language: "it" }, {}, `10.7.7.${i}`);
await waitMail(beforeAddress + 2);
await new Promise((r2) => setTimeout(r2, 400));
check("reset: lo stesso indirizzo da IP diversi, oltre 3 all'ora, non riceve altre email", mails.length - beforeAddress === 2, `mail=${mails.length - beforeAddress}`);
check("reset: i contatori sono nel database", Object.keys(hits).some((bucket) => bucket.startsWith("password-reset:ip:")) && Object.keys(hits).some((bucket) => bucket.startsWith("password-reset:address:")), Object.keys(hits).join(","));
r = await (async () => { let st = 0; const res: any = { setHeader() {}, status(n: number) { st = n; return res; }, json() { return res; } }; await reset({ method: "GET", headers: {}, body: {}, socket: {} } as any, res); return { status: st }; })();
check("reset: GET -> 405", r.status === 405);

// ===== portal-actions =====
const asAdmin = { authorization: "Bearer tok-admin" };
const asUser = { authorization: "Bearer tok-user" };
let m0 = mails.length;
r = await call(actions, { action: "create_user", email: "new@x.com", password: "TempPass123456", full_name: "Nuovo Utente", role: "admin", language: "en" }, asAdmin);
check("create_user: 200 e welcome.sent", r.status === 200 && r.payload?.welcome?.sent === true, JSON.stringify(r.payload));
check("create_user: app_metadata.must_change_password = true", created[0]?.app_metadata?.must_change_password === true);
check("create_user: profilo con language en", upserts["/rest/v1/profiles"]?.some((x: any) => x.language === "en") === true);
await waitMail(m0 + 1);
body = mails[m0] ? decode(mails[m0]) : "";
check("create_user: email di benvenuto in inglese a new@x.com", mails[m0]?.to === "new@x.com" && /Welcome, Nuovo Utente/.test(body) && /kind=welcome/.test(body), mails[m0]?.to);
check("create_user: la password provvisoria NON e' nell'email", !body.includes("TempPass123456"));

m0 = mails.length;
r = await call(actions, { action: "create_user", email: "n2@x.com", password: "TempPass123456", full_name: "Due", role: "admin", send_welcome: false }, asAdmin);
check("create_user: send_welcome=false -> nessuna email", r.status === 200 && r.payload?.welcome?.sent === false && mails.length === m0);
r = await call(actions, { action: "create_user", email: "n3@x.com", password: "x", full_name: "Tre", role: "agente" }, asUser);
check("create_user da non admin -> 403", r.status === 403);

r = await call(actions, { action: "set_password", password: "corta" }, asUser);
check("set_password: troppo corta -> 400 weak_password", r.status === 400 && r.payload?.code === "weak_password");
r = await call(actions, { action: "set_password", password: "senzamaiuscola123" }, asUser);
check("set_password: senza maiuscola -> 400", r.status === 400 && r.payload?.code === "weak_password");
r = await call(actions, { action: "set_password", password: "TempPass123456" }, asUser);
check("set_password: uguale alla provvisoria -> 400 same_password", r.status === 400 && r.payload?.code === "same_password", JSON.stringify(r.payload));
check("set_password: nessuna modifica quando rifiutata", adminPuts.length === 0);
r = await call(actions, { action: "set_password", password: "NuovaPasswordSicura42" }, asUser);
check("set_password: valida -> 200", r.status === 200 && r.payload?.success === true, JSON.stringify(r.payload));
check("set_password: scritta con password e flag false", adminPuts[0]?.id === "11111111-1111-4111-8111-111111111111" && adminPuts[0]?.body?.password === "NuovaPasswordSicura42" && adminPuts[0]?.body?.app_metadata?.must_change_password === false, JSON.stringify(adminPuts[0]));
r = await call(actions, { action: "set_password", password: "NuovaPasswordSicura42" }, {});
check("set_password: senza token -> 401", r.status === 401);

m0 = mails.length;
r = await call(actions, { action: "resend_access_email", userId: "22222222-2222-4222-8222-222222222222" }, asAdmin);
await waitMail(m0 + 1);
check("resend: mai entrato -> benvenuto", r.payload?.sent === true && /kind=welcome/.test(decode(mails[m0]!)), JSON.stringify(r.payload));
m0 = mails.length;
r = await call(actions, { action: "resend_access_email", userId: "33333333-3333-4333-8333-333333333333" }, asAdmin);
await waitMail(m0 + 1);
check("resend: gia' entrato -> link reimposta password", r.payload?.sent === true && /kind=recovery/.test(decode(mails[m0]!)));
r = await call(actions, { action: "resend_access_email", userId: "22222222-2222-4222-8222-222222222222" }, asUser);
check("resend: da non admin -> 403", r.status === 403);

process.env.GMAIL_USER = ""; process.env.GMAIL_APP_PASSWORD = "";
r = await call(actions, { action: "create_user", email: "n4@x.com", password: "TempPass123456", full_name: "Quattro", role: "admin" }, asAdmin);
check("create_user senza servizio email: utente creato, welcome.sent=false con motivo", r.status === 200 && r.payload?.welcome?.sent === false && !!r.payload?.welcome?.reason, JSON.stringify(r.payload?.welcome));

afterAll(() => {
  smtpSink.close();
  supabaseStub.close();
});

report();
