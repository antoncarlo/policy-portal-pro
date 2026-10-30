-- Optional PEC of the beneficiary office (DATI FOGLIO sheet of the VIES template).
-- It is stored on each job and sent to the external portal with the rest of the row.
-- claim_vies_jobs returns SETOF vies_jobs, so the column reaches the orchestrator as is.
alter table public.vies_jobs add column if not exists pec_beneficiario text;
