# Modelli email di Supabase (italiano · inglese · cinese)

Si incollano a mano in Supabase → Authentication → Emails → Templates / Notifications
(https://supabase.com/dashboard/project/nesblhtjqiavdfsrtfom/auth/templates).
Per ogni voce: campo **Subject** = oggetto della tabella, campo **Message body** = contenuto del file HTML.

| Voce del pannello | File | Oggetto (Subject) |
|---|---|---|
| Confirm sign up | `confirm-sign-up.html` | Conferma il tuo indirizzo email · Confirm your email address · 确认邮箱地址 |
| Invite user | `invite-user.html` | Invito al portale Tecno Advance MGA · Invitation to the portal · 门户邀请 |
| Magic link or OTP | `magic-link.html` | Il tuo link di accesso · Your sign-in link · 登录链接 |
| Change email address | `change-email-address.html` | Conferma il nuovo indirizzo email · Confirm your new email address · 确认新邮箱地址 |
| Reset password | `reset-password.html` | Reimposta la password · Reset your password · 重置密码 |
| Reauthentication | `reauthentication.html` | Il tuo codice di verifica · Your verification code · 验证码 |
| Security → Password changed | `password-changed.html` | La password del tuo account è stata modificata · Your account password was changed · 账号密码已修改 |
| Security → Email address changed | `email-changed.html` | L'email del tuo account è stata modificata · Your account email was changed · 账号邮箱已更改 |

Variabili usate (le sostituisce Supabase): `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .Token }}`.
Il logo è `https://portale.tecnomga.com/brand/tecno-mga-logo.png`.
