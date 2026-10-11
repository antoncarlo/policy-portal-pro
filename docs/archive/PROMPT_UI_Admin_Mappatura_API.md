# Prompt — UI Admin per Mappatura API → Utente (Claude Code / Opus 4.7)

Incolla il blocco sottostante in Claude Code (sessione nuova) per generare la UI admin che gestisce la tabella `api_key_user_mapping`.

---

## Objective
Build an admin-only UI in Policy Portal Pro to manage the `api_key_user_mapping` table: let an admin assign (and reassign/remove) which portal user owns the practices that arrive via each partner's API key. This makes webhook-received practices visible to that partner via existing RLS.

## Context
- Stack: React + TypeScript + Vite + Tailwind + shadcn/ui, Supabase backend, npm. Existing app theme (navy primary `#103657`, gold accent `#ac7e59`) is applied via theme tokens — use existing tokens/classes, do NOT hardcode colors.
- The backend is already done: migration `supabase/migrations/20260606_api_key_user_mapping.sql` created table `public.api_key_user_mapping (id uuid pk, api_key_id uuid NOT NULL UNIQUE → api_keys.id, user_id uuid NOT NULL → auth.users.id, created_at)` with RLS policy "Admins can manage api_key_user_mapping" (FOR ALL, has_role(auth.uid(),'admin')). The webhook `api/webhook-receive-policy.ts` already resolves owner via this table, falling back to WEBHOOK_DEFAULT_USER_ID.
- Reference component to copy patterns from EXACTLY: `src/components/settings/admin/ApiKeysSettings.tsx`. It uses `(supabase as any).from('api_keys')` for untyped queries, shadcn `Table/Dialog/AlertDialog/Button/Badge/Card/Select`, `useToast`, lucide-react icons, and `useCallback`-wrapped loaders.
- Data sources available to the frontend client:
  - `api_keys`: select `id, name, partner_email, is_active` (order by created_at desc).
  - `profiles`: select `id, full_name, email` (id == auth.users.id) — use this to populate the user picker; the frontend cannot query auth.users directly.
  - `api_key_user_mapping`: select `id, api_key_id, user_id`.
- Settings page mounts admin tabs in `src/pages/Settings.tsx`: there is a `<TabsList>` and `{showAdminTabs && (<> ... </>)}` blocks for both `<TabsTrigger>` and `<TabsContent>`. The existing `api-keys` tab imports `ApiKeysSettings` (import at top, trigger value `"api-keys"`, content `<TabsContent value="api-keys">`).

## Target State
1. New component `src/components/settings/admin/ApiKeyMappingSettings.tsx` that:
   - Loads all `api_keys`, all `profiles`, and all `api_key_user_mapping` rows on mount.
   - Renders a shadcn `Table` with one row per API key showing: key name, partner_email, active badge, and the currently-mapped user (full_name + email, or "Nessuna mappatura").
   - Each row has a shadcn `Select` (options = profiles, label `full_name (email)`) plus a Save action that UPSERTS into `api_key_user_mapping` on conflict `api_key_id` (one user per key), and a "Rimuovi" action (with `AlertDialog` confirm) that deletes the mapping for that key.
   - Uses `(supabase as any)` for all three tables, `useToast` for success/error, loading state, and matches the visual style and Italian copy of `ApiKeysSettings.tsx`.
2. `src/pages/Settings.tsx`: add an import for `ApiKeyMappingSettings`, a new `<TabsTrigger value="api-mapping">` (lucide `Link2` icon, label `Mappatura API`) inside the `showAdminTabs` trigger block next to `api-keys`, and a matching `<TabsContent value="api-mapping"><ApiKeyMappingSettings /></TabsContent>` inside the `showAdminTabs` content block.

## Scope
- Work ONLY in: `src/components/settings/admin/ApiKeyMappingSettings.tsx` (new) and `src/pages/Settings.tsx` (mount the tab).
- Do NOT touch: the migration SQL, `api/webhook-receive-policy.ts`, any RLS policy, `.env`, `api/create-user.js`, `ApiKeysSettings.tsx`, auth middleware, or any other file.

## Constraints
- No new npm dependencies — use only shadcn/ui components and lucide-react icons already in the project.
- Use the same untyped `(supabase as any).from(...)` query pattern already used in `ApiKeysSettings.tsx`. Do not add a Supabase Database generic.
- Reuse existing theme tokens/classes — no hardcoded hex colors, no new global CSS.
- All user-facing strings in Italian, matching the tone of existing settings components.
- Only make changes directly requested. Do not refactor existing code, add extra tabs, or add features beyond the mapping CRUD described.

## Acceptance Criteria
- [ ] `npx tsc --noEmit` passes with zero new errors.
- [ ] `npm run build` succeeds.
- [ ] The new "Mappatura API" tab appears only for admins (inside `showAdminTabs`) and renders the table.
- [ ] Assigning a user to a key writes one row (upsert on `api_key_id`); reassigning updates the same row; "Rimuovi" deletes it — each reflected in the UI without a manual refresh.

## Stop Conditions
Stop and ask before:
- Deleting any file
- Adding any dependency
- Modifying database schema, migrations, or RLS
- Touching anything outside Scope

## Progress
After each completed step: ✅ [what was done] — [file(s) affected]

Think carefully and step-by-step before starting.

---

**Target:** Claude Code (Opus 4.7).
**Nota:** prompt per tool agentico con accesso reale al filesystem. Verifica scope, azioni vietate e stop conditions prima di incollare.
