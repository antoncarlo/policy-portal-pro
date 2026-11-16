-- Richieste di preventivo dal sito aziendale (tecnomga.com) nella stessa tabella delle richieste di contatto del
-- sito VIES: stessa rotta /api/contact, stesse regole (scrive solo il server, leggono solo gli amministratori,
-- cancellazione dopo 24 mesi).
--
-- `site` dice da quale sito arriva la richiesta; `product` il prodotto per cui si chiede il preventivo.
-- Società, ruolo e Paese restano obbligatori per le richieste del portale e diventano facoltativi per quelle del
-- sito aziendale, che non li chiede. Le righe esistenti sono del portale e restano valide.

alter table public.contact_requests
  add column if not exists site text not null default 'portal',
  add column if not exists product text;

alter table public.contact_requests drop constraint if exists contact_requests_site_check;
alter table public.contact_requests
  add constraint contact_requests_site_check check (site in ('portal', 'corporate'));

alter table public.contact_requests drop constraint if exists contact_requests_product_check;
alter table public.contact_requests
  add constraint contact_requests_product_check check (
    product is null
    or product in ('fideiussioni', 'car', 'decennale-postuma', 'rc-professionale', 'd-and-o', 'pet', 'fotovoltaico', 'impresa-commercio', 'casa', 'auto', 'infortuni-malattia', 'altro')
  );

alter table public.contact_requests
  alter column company drop not null,
  alter column role drop not null,
  alter column country drop not null;

-- Una richiesta del portale ha sempre società, ruolo e Paese, e non ha un prodotto.
alter table public.contact_requests drop constraint if exists contact_requests_portal_fields_check;
alter table public.contact_requests
  add constraint contact_requests_portal_fields_check check (
    site <> 'portal' or (company is not null and role is not null and country is not null and product is null)
  );

create index if not exists contact_requests_site_idx on public.contact_requests (site, created_at desc);
