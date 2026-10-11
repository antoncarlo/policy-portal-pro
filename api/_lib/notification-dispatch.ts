import type { SupabaseClient } from '@supabase/supabase-js';
import { stageOf, type PracticeStage } from '../../src/lib/practiceStages.js';
import { portalUrl } from './auth-emails.js';
import { sendMailLogged } from './email-log.js';
import { getMailProvider } from './mailer.js';
import {
  copyFor,
  formatDate,
  MAX_LISTED_ITEMS,
  renderEmail,
  toLanguage,
  type Language,
  type PracticeInfo,
  type StatusDetails,
} from './notification-copy.js';

/**
 * Sends the notification emails. The database queues one event for every fact about a practice (uploaded,
 * status or payment changed, documents added, notes changed), whatever path led to it; this module reads
 * the queue, decides who is written to and sends personal emails:
 *
 *   status change    the person who owns the practice and their reference agent; the administrators too when
 *                    somebody else than an administrator moved it (the company's portal, the system)
 *   new practice     the administrators and the reference agent of whoever uploaded it
 *   documents, notes the administrators, the reference agent and the owner
 *
 * Whoever caused the event is never written to about it. Each user's addresses and event types are chosen
 * by the administrator (user_notification_settings); without a choice the sign-in email is used.
 * Several events for the same person in one run become one email.
 */

type EventType = 'practice_created' | 'status_changed' | 'documents_added' | 'note_changed' | 'info_reminder' | 'info_overdue';

interface QueuedEvent {
  id: string;
  event_type: EventType;
  practice_id: string;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  attempts: number;
}

interface PracticeRow {
  id: string;
  practice_number: string;
  practice_type: string;
  client_name: string;
  user_id: string;
  status: string;
  financial_status: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  language: string | null;
  email_notifications: Record<string, unknown> | null;
}

interface SettingsRow {
  user_id: string;
  notification_emails: string[] | null;
  status_change: boolean;
  new_practice: boolean;
  documents: boolean;
  notes: boolean;
}

interface RoleRow {
  user_id: string;
  role: string;
  parent_agent_id: string | null;
}

interface WorkflowRow {
  practice_id: string;
  payment_due_date: string | null;
  deliberation_note: string | null;
  rejection_reason: string | null;
  info_due_date: string | null;
}

/** What is not sent any more: an email days late is worse than none. */
const EVENT_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** Events taken in one run: a lot of 3000 practices is one email, not several. */
const MAX_EVENTS_PER_RUN = 5000;
const PAGE_SIZE = 1000;
const SEND_CONCURRENCY = 4;
/** Documents loaded together with a new practice belong to its email. */
const CREATION_WINDOW_MS = 30 * 60 * 1000;
const IN_CHUNK = 100;
const QUERY_CONCURRENCY = 6;

const RULES: Record<EventType, { setting: keyof Omit<SettingsRow, 'user_id' | 'notification_emails'>; profile: string | null }> = {
  status_changed: { setting: 'status_change', profile: 'status_change' },
  practice_created: { setting: 'new_practice', profile: 'new_practice' },
  documents_added: { setting: 'documents', profile: 'new_document' },
  note_changed: { setting: 'notes', profile: null },
  info_reminder: { setting: 'status_change', profile: 'status_change' },
  info_overdue: { setting: 'status_change', profile: 'status_change' },
};

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const isEmailAddress = (value: unknown): value is string => typeof value === 'string' && EMAIL_PATTERN.test(value.trim()) && value.length <= 254;

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const unique = <T>(values: T[]) => [...new Set(values)];
const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** One person (or one fixed address) an email goes to. */
interface Target {
  key: string;
  userId: string | null;
  emails: string[];
  name: string;
  language: Language;
  isAdmin: boolean;
}

interface Context {
  practices: Map<string, PracticeRow>;
  workflow: Map<string, WorkflowRow>;
  infoRequests: Map<string, string>;
  profiles: Map<string, ProfileRow>;
  settings: Map<string, SettingsRow>;
  roles: Map<string, RoleRow[]>;
  adminIds: string[];
  creation: Map<string, { actor: string | null; at: number }>;
  extraEmails: string[];
}

interface Delivery {
  target: Target;
  type: EventType;
  actorId: string | null;
  events: QueuedEvent[];
}

interface Built {
  subject: string;
  html: string;
  practiceId: string;
  type: EventType;
}

export interface DispatchSummary {
  claimed: number;
  emails: number;
  failed: number;
  released: number;
  expired: number;
  skipped?: 'no_mail_provider';
}

/** Fixed addresses that also hear about every new practice (the office mailboxes). */
export function extraAddresses(): string[] {
  const raw = process.env.ADMIN_NOTIFICATION_EMAILS ?? 'info@tecnomga.com,antoncarlo@tecnomga.com';
  if (raw.trim().toLowerCase() === 'none') return [];
  return unique(raw.split(',').map((address) => address.trim().toLowerCase()).filter(isEmailAddress));
}

/** Runs the tasks a few at a time. */
async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(...(await Promise.all(items.slice(index, index + size).map(task))));
  }
  return results;
}

const chunksOf = <T>(values: T[], size: number) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));

async function selectIn<T>(supabase: SupabaseClient, table: string, columns: string, column: string, ids: string[], filter?: { column: string; value: string }): Promise<T[]> {
  const pages = await inBatches(chunksOf(ids, IN_CHUNK), QUERY_CONCURRENCY, async (chunk) => {
    const query = supabase.from(table).select(columns).in(column, chunk);
    const { data, error } = await (filter ? query.eq(filter.column, filter.value) : query);
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as unknown as T[];
  });
  return pages.flat();
}

async function loadContext(supabase: SupabaseClient, events: QueuedEvent[]): Promise<Context> {
  const practiceIds = unique(events.map((event) => event.practice_id));
  const practiceRows = await selectIn<PracticeRow>(supabase, 'practices', 'id, practice_number, practice_type, client_name, user_id, status, financial_status', 'id', practiceIds);
  const practices = new Map(practiceRows.map((row) => [row.id, row]));
  const ownerIds = unique(practiceRows.map((row) => row.user_id));

  const statusEvents = events.filter((event) => event.event_type === 'status_changed');
  const toStatus = (event: QueuedEvent) => String(event.payload?.new_status ?? '');
  const decidedIds = unique(statusEvents.filter((event) => ['approvata', 'rifiutata'].includes(toStatus(event))).map((event) => event.practice_id));
  const infoIds = unique([
    ...statusEvents.filter((event) => toStatus(event) === 'integrazioni').map((event) => event.practice_id),
    ...events.filter((event) => event.event_type === 'info_reminder' || event.event_type === 'info_overdue').map((event) => event.practice_id),
  ]);
  const documentIds = unique(events.filter((event) => event.event_type === 'documents_added').map((event) => event.practice_id));

  const [workflowRows, infoRows, adminRows, ownerRoleRows, creationRows] = await Promise.all([
    selectIn<WorkflowRow>(supabase, 'practice_workflow', 'practice_id, payment_due_date, deliberation_note, rejection_reason, info_due_date', 'practice_id', unique([...decidedIds, ...infoIds])),
    selectIn<{ practice_id: string; description: string | null; created_at: string }>(supabase, 'practice_events', 'practice_id, description, created_at', 'practice_id', infoIds, {
      column: 'event_type',
      value: 'workflow_info_requested',
    }),
    supabase.from('user_roles').select('user_id, role, parent_agent_id').eq('role', 'admin'),
    selectIn<RoleRow>(supabase, 'user_roles', 'user_id, role, parent_agent_id', 'user_id', ownerIds),
    selectIn<{ practice_id: string; actor_id: string | null; created_at: string }>(supabase, 'notification_events', 'practice_id, actor_id, created_at', 'practice_id', documentIds, {
      column: 'event_type',
      value: 'practice_created',
    }),
  ]);
  if (adminRows.error) throw new Error(`user_roles: ${adminRows.error.message}`);
  const admins = (adminRows.data ?? []) as unknown as RoleRow[];
  const adminIds = unique(admins.map((row) => row.user_id));

  const roles = new Map<string, RoleRow[]>();
  for (const row of [...ownerRoleRows, ...admins]) roles.set(row.user_id, [...(roles.get(row.user_id) ?? []), row]);

  const parentIds = ownerRoleRows.map((row) => row.parent_agent_id).filter((id): id is string => Boolean(id));
  const personIds = unique([...ownerIds, ...parentIds, ...adminIds, ...events.map((event) => event.actor_id).filter((id): id is string => Boolean(id))]);
  const [profileRows, settingRows] = await Promise.all([
    selectIn<ProfileRow>(supabase, 'profiles', 'id, full_name, email, language, email_notifications', 'id', personIds),
    selectIn<SettingsRow>(supabase, 'user_notification_settings', 'user_id, notification_emails, status_change, new_practice, documents, notes', 'user_id', personIds),
  ]);

  // The latest request wins; its text is stored after "Integrazioni richieste: ".
  const infoRequests = new Map<string, string>();
  for (const row of [...infoRows].sort((a, b) => (a.created_at > b.created_at ? 1 : -1))) {
    const text = (row.description ?? '').replace(/^Integrazioni richieste:\s*/i, '').trim();
    if (text) infoRequests.set(row.practice_id, shorten(text, 400));
  }

  return {
    practices,
    workflow: new Map(workflowRows.map((row) => [row.practice_id, row])),
    infoRequests,
    profiles: new Map(profileRows.map((row) => [row.id, row])),
    settings: new Map(settingRows.map((row) => [row.user_id, row])),
    roles,
    adminIds,
    creation: new Map(creationRows.map((row) => [row.practice_id, { actor: row.actor_id, at: Date.parse(row.created_at) }])),
    extraEmails: extraAddresses(),
  };
}

/** The person as a recipient for this kind of event, or null when they must not be written to. */
function userTarget(userId: string, type: EventType, context: Context): Target | null {
  const profile = context.profiles.get(userId);
  if (!profile) return null;
  const rule = RULES[type];
  const settings = context.settings.get(userId);
  if (settings && settings[rule.setting] === false) return null;
  // The person's own switches (profile settings) are honoured as well.
  if (rule.profile && profile.email_notifications?.[rule.profile] === false) return null;
  const chosen = (settings?.notification_emails ?? []).map((address) => address.trim()).filter(isEmailAddress);
  const emails = unique((chosen.length > 0 ? chosen : isEmailAddress(profile.email) ? [profile.email.trim()] : []).map((address) => address.toLowerCase()));
  if (emails.length === 0) return null;
  return {
    key: userId,
    userId,
    emails,
    name: profile.full_name?.trim() || '',
    language: toLanguage(profile.language),
    isAdmin: context.adminIds.includes(userId),
  };
}

function targetsFor(event: QueuedEvent, practice: PracticeRow, context: Context): Target[] {
  const actor = event.actor_id;
  const parentId = (context.roles.get(practice.user_id) ?? []).map((row) => row.parent_agent_id).find(Boolean) ?? null;
  const actorIsAdmin = actor !== null && context.adminIds.includes(actor);

  let people: Array<string | null>;
  switch (event.event_type) {
    case 'status_changed':
      people = [practice.user_id, parentId, ...(actorIsAdmin ? [] : context.adminIds)];
      break;
    case 'practice_created':
      people = [...context.adminIds, parentId];
      break;
    case 'info_reminder':
      // Whoever must provide the documents: the owner of the practice and their reference agent.
      people = [practice.user_id, parentId];
      break;
    case 'info_overdue':
      // Past the term the administrators hear about it too.
      people = [practice.user_id, parentId, ...context.adminIds];
      break;
    default:
      people = [...context.adminIds, parentId, practice.user_id];
  }
  const targets = unique(people.filter((id): id is string => Boolean(id) && id !== actor))
    .map((id) => userTarget(id, event.event_type, context))
    .filter((target): target is Target => target !== null);

  if (event.event_type === 'practice_created') {
    // The office mailboxes: never the same address twice, never the person who uploaded.
    const taken = new Set(targets.flatMap((target) => target.emails));
    const actorProfile = actor ? context.profiles.get(actor) : null;
    if (actorProfile?.email) taken.add(actorProfile.email.trim().toLowerCase());
    for (const address of actor ? context.settings.get(actor)?.notification_emails ?? [] : []) taken.add(address.trim().toLowerCase());
    for (const address of context.extraEmails) {
      if (taken.has(address)) continue;
      taken.add(address);
      targets.push({ key: `fixed:${address}`, userId: null, emails: [address], name: '', language: 'it', isAdmin: true });
    }
  }
  return targets;
}

/** Documents that came with the upload of the practice are part of its "new practice" email. */
function belongsToCreation(event: QueuedEvent, context: Context) {
  const creation = context.creation.get(event.practice_id);
  // The same person, or the system (a document the server generates for the practice).
  if (!creation || (event.actor_id !== null && creation.actor !== event.actor_id)) return false;
  const delay = Date.parse(event.created_at) - creation.at;
  return delay >= -60_000 && delay <= CREATION_WINDOW_MS;
}

const linkFor = (practiceId: string) => `${portalUrl()}/practices/${practiceId}`;

function infoFor(practice: PracticeRow, target: Target, context: Context): PracticeInfo {
  const owner = practice.user_id === target.userId ? null : context.profiles.get(practice.user_id)?.full_name?.trim() || null;
  return { id: practice.id, number: practice.practice_number, type: practice.practice_type, client: practice.client_name, ownerName: owner };
}

function statusDetails(stage: PracticeStage, practiceId: string, language: Language, context: Context): StatusDetails {
  const workflow = context.workflow.get(practiceId);
  switch (stage) {
    case 'deliberata':
      return { dueDate: formatDate(workflow?.payment_due_date, language), note: workflow?.deliberation_note?.trim() || null };
    case 'non_deliberata':
      return { reason: workflow?.rejection_reason?.trim() || null };
    case 'integrazioni':
      return { info: context.infoRequests.get(practiceId) ?? null, dueDate: formatDate(workflow?.info_due_date, language) };
    default:
      return {};
  }
}

function groupByPractice(events: QueuedEvent[]) {
  const groups = new Map<string, QueuedEvent[]>();
  for (const event of [...events].sort((a, b) => (a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0))) {
    groups.set(event.practice_id, [...(groups.get(event.practice_id) ?? []), event]);
  }
  return groups;
}

function actorName(actorId: string | null, language: Language, context: Context, events: QueuedEvent[] = []) {
  if (!actorId) {
    // Not a signed-in person: the API client that sent the practice, when it is named.
    const source = events.map((event) => event.payload?.source).find((value): value is string => typeof value === 'string' && value.trim() !== '');
    return source?.trim() || copyFor(language).system;
  }
  const profile = context.profiles.get(actorId);
  return profile?.full_name?.trim() || profile?.email || copyFor(language).system;
}

function buildStatus(delivery: Delivery, context: Context): Built | null {
  const { target } = delivery;
  const copy = copyFor(target.language);
  const items: Array<{ practice: PracticeRow; stage: PracticeStage }> = [];
  for (const [practiceId, events] of groupByPractice(delivery.events)) {
    const practice = context.practices.get(practiceId);
    if (!practice) continue;
    // From where the practice was to where it is now: back and forth in one run is not news.
    const first = events[0].payload ?? {};
    const last = events[events.length - 1].payload ?? {};
    const from = stageOf({ status: String(first.old_status ?? ''), financial_status: (first.old_financial_status as string | null) ?? null });
    const to = stageOf({ status: String(last.new_status ?? ''), financial_status: (last.new_financial_status as string | null) ?? null });
    if (from !== to) items.push({ practice, stage: to });
  }
  if (items.length === 0) return null;

  if (items.length === 1) {
    const { practice, stage } = items[0];
    const details = statusDetails(stage, practice.id, target.language, context);
    const subject = copy.statusSubject(practice.practice_number, stage);
    const paragraphs = [copy.greeting(target.name), cap(copy.statusSentence[stage](copy.label(infoFor(practice, target, context)), details))];
    if (stage === 'deliberata' && details.note) paragraphs.push(copy.note(shorten(details.note, 400)));
    paragraphs.push(copy.statusAction[stage](details));
    return {
      subject,
      html: renderEmail({ language: target.language, title: subject, paragraphs, button: { label: copy.buttonOne, url: linkFor(practice.id) }, footer: copy.footer }),
      practiceId: practice.id,
      type: 'status_changed',
    };
  }

  const subject = copy.statusManySubject(items.length);
  const shown = items.slice(0, MAX_LISTED_ITEMS);
  return {
    subject,
    html: renderEmail({
      language: target.language,
      title: subject,
      paragraphs: [copy.greeting(target.name), copy.statusManyIntro(items.length)],
      listing: shown.map(({ practice, stage }) => ({ text: `${copy.label(infoFor(practice, target, context))} — ${copy.stageShort[stage]}`, url: linkFor(practice.id) })),
      listingMore: items.length - shown.length,
      closing: [copy.statusManyAction],
      button: { label: copy.buttonMany, url: `${portalUrl()}/practices` },
      footer: copy.footer,
    }),
    practiceId: items[0].practice.id,
    type: 'status_changed',
  };
}

function buildInfoDeadline(delivery: Delivery, context: Context): Built | null {
  const { target, type } = delivery;
  const copy = copyFor(target.language);
  const section = copy.infoDeadline;
  const overdue = type === 'info_overdue';
  const entries = [...groupByPractice(delivery.events)]
    .map(([practiceId]) => context.practices.get(practiceId))
    // Only what is still waiting for the documents: a practice moved on since the event was queued is not news.
    .filter((practice): practice is PracticeRow => Boolean(practice) && practice?.status === 'integrazioni');
  if (entries.length === 0) return null;
  const dueOf = (practice: PracticeRow) => formatDate(context.workflow.get(practice.id)?.info_due_date, target.language) ?? '—';
  const closing = [section.action, ...(overdue && target.isAdmin ? [section.escalation] : [])];

  if (entries.length === 1) {
    const practice = entries[0];
    const label = copy.label(infoFor(practice, target, context));
    const request = context.infoRequests.get(practice.id) ?? null;
    const subject = overdue ? section.overdueSubjectOne(practice.practice_number) : section.reminderSubjectOne(practice.practice_number, dueOf(practice));
    const intro = overdue ? section.overdueIntroOne(label, dueOf(practice), request) : section.reminderIntroOne(label, dueOf(practice), request);
    return {
      subject,
      html: renderEmail({ language: target.language, title: subject, paragraphs: [copy.greeting(target.name), intro, ...closing], button: { label: copy.buttonOne, url: linkFor(practice.id) }, footer: copy.footer }),
      practiceId: practice.id,
      type,
    };
  }

  const subject = overdue ? section.overdueSubjectMany(entries.length) : section.reminderSubjectMany(entries.length);
  const shown = entries.slice(0, MAX_LISTED_ITEMS);
  return {
    subject,
    html: renderEmail({
      language: target.language,
      title: subject,
      paragraphs: [copy.greeting(target.name), overdue ? section.overdueIntroMany(entries.length) : section.reminderIntroMany(entries.length)],
      listing: shown.map((practice) => ({ text: `${copy.label(infoFor(practice, target, context))} — ${dueOf(practice)}`, url: linkFor(practice.id) })),
      listingMore: entries.length - shown.length,
      closing,
      button: { label: copy.buttonMany, url: `${portalUrl()}/practices` },
      footer: copy.footer,
    }),
    practiceId: entries[0].id,
    type,
  };
}

function fileNames(events: QueuedEvent[]) {
  const names = unique(events.map((event) => String(event.payload?.file_name ?? '').trim()).filter(Boolean));
  const shown = names.slice(0, 5).join(', ');
  return names.length > 5 ? `${shown}, …` : shown || '—';
}

function buildActivity(delivery: Delivery, context: Context): Built | null {
  const { target, type } = delivery;
  const copy = copyFor(target.language);
  const who = actorName(delivery.actorId, target.language, context, delivery.events);
  const entries = [...groupByPractice(delivery.events)]
    .map(([practiceId, events]) => ({ practice: context.practices.get(practiceId), events }))
    .filter((entry): entry is { practice: PracticeRow; events: QueuedEvent[] } => Boolean(entry.practice));
  if (entries.length === 0) return null;

  const section = type === 'practice_created' ? copy.created : type === 'documents_added' ? copy.documents : copy.notes;
  const labelOf = (practice: PracticeRow) => {
    const info = infoFor(practice, target, context);
    // The uploader is named in the sentence already.
    return copy.label(practice.user_id === delivery.actorId ? { ...info, ownerName: null } : info);
  };
  const needsReview = type === 'documents_added' && target.isAdmin && entries.some((entry) => entry.practice.status === 'integrazioni');
  const closing = [section.action, ...(needsReview ? [copy.documents.missingInfo] : [])];

  if (entries.length === 1) {
    const { practice, events } = entries[0];
    const label = labelOf(practice);
    const subject = type === 'practice_created' ? copy.created.subjectOne(practice.practice_number, who) : type === 'documents_added' ? copy.documents.subjectOne(practice.practice_number) : copy.notes.subjectOne(practice.practice_number);
    const intro =
      type === 'practice_created' ? copy.created.introOne(who, label) : type === 'documents_added' ? copy.documents.introOne(who, label, fileNames(events)) : copy.notes.introOne(who, label);
    return {
      subject,
      html: renderEmail({
        language: target.language,
        title: subject,
        paragraphs: [copy.greeting(target.name), intro, ...closing],
        button: { label: copy.buttonOne, url: linkFor(practice.id) },
        footer: copy.footer,
      }),
      practiceId: practice.id,
      type,
    };
  }

  const subject = type === 'practice_created' ? copy.created.subjectMany(entries.length, who) : type === 'documents_added' ? copy.documents.subjectMany(entries.length) : copy.notes.subjectMany(entries.length);
  const intro = type === 'practice_created' ? copy.created.introMany(who, entries.length) : type === 'documents_added' ? copy.documents.introMany(who, entries.length) : copy.notes.introMany(who, entries.length);
  const shown = entries.slice(0, MAX_LISTED_ITEMS);
  return {
    subject,
    html: renderEmail({
      language: target.language,
      title: subject,
      paragraphs: [copy.greeting(target.name), intro],
      listing: shown.map(({ practice, events }) => ({
        text: type === 'documents_added' ? `${labelOf(practice)}: ${fileNames(events)}` : labelOf(practice),
        url: linkFor(practice.id),
      })),
      listingMore: entries.length - shown.length,
      closing,
      button: { label: copy.buttonMany, url: `${portalUrl()}/practices` },
      footer: copy.footer,
    }),
    practiceId: entries[0].practice.id,
    type,
  };
}

function planDeliveries(events: QueuedEvent[], context: Context): Delivery[] {
  const deliveries = new Map<string, Delivery>();
  for (const event of events) {
    const practice = context.practices.get(event.practice_id);
    if (!practice) continue;
    if (event.event_type === 'documents_added' && belongsToCreation(event, context)) continue;
    for (const target of targetsFor(event, practice, context)) {
      // Status changes are one email per person; the rest one per person and author.
      const key =
        event.event_type === 'status_changed'
          ? `${target.key}|status`
          : event.event_type === 'info_reminder' || event.event_type === 'info_overdue'
            ? `${target.key}|${event.event_type}`
            : `${target.key}|${event.event_type}|${event.actor_id ?? ''}`;
      const delivery = deliveries.get(key) ?? { target, type: event.event_type, actorId: event.actor_id, events: [] };
      delivery.events.push(event);
      deliveries.set(key, delivery);
    }
  }
  return [...deliveries.values()];
}

async function releaseEvents(supabase: SupabaseClient, events: QueuedEvent[], error: string) {
  const byAttempts = new Map<number, string[]>();
  for (const event of events) byAttempts.set(event.attempts, [...(byAttempts.get(event.attempts) ?? []), event.id]);
  for (const [previous, ids] of byAttempts) {
    const attempts = previous + 1;
    // Out of attempts: it stays processed, with the reason on record.
    const patch = attempts >= MAX_ATTEMPTS ? { attempts, last_error: shorten(error, 500) } : { processed_at: null, attempts, last_error: shorten(error, 500) };
    await inBatches(chunksOf(ids, IN_CHUNK), QUERY_CONCURRENCY, async (chunk) => {
      await supabase.from('notification_events').update(patch).in('id', chunk);
    });
  }
}

/** Takes the waiting events. Claiming is a conditional update: two runs at the same time never take the same event. */
async function claimEvents(supabase: SupabaseClient): Promise<QueuedEvent[]> {
  const claimed: QueuedEvent[] = [];
  for (let page = 0; page < 6 && claimed.length < MAX_EVENTS_PER_RUN; page += 1) {
    const { data: pending, error: pendingError } = await supabase
      .from('notification_events')
      .select('id')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(PAGE_SIZE);
    if (pendingError) throw new Error(`notification_events: ${pendingError.message}`);
    const ids = ((pending ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length === 0) break;

    const taken = await inBatches(chunksOf(ids, IN_CHUNK), QUERY_CONCURRENCY, async (chunk) => {
      const { data, error } = await supabase
        .from('notification_events')
        .update({ processed_at: new Date().toISOString() })
        .in('id', chunk)
        .is('processed_at', null)
        .select('id, event_type, practice_id, actor_id, payload, created_at, attempts');
      if (error) throw new Error(`notification_events: ${error.message}`);
      return (data ?? []) as unknown as QueuedEvent[];
    });
    const rows = taken.flat();
    claimed.push(...rows);
    // Nothing left to take, or somebody else is taking them: stop here.
    if (ids.length < PAGE_SIZE || rows.length === 0) break;
  }
  return claimed;
}

async function sendAll(supabase: SupabaseClient, claimed: QueuedEvent[], summary: DispatchSummary) {
  try {
    const context = await loadContext(supabase, claimed);
    const deliveries = planDeliveries(claimed, context);
    const sentFor = new Set<string>();
    const failedFor = new Map<string, string>();

    await inBatches(deliveries, SEND_CONCURRENCY, async (delivery) => {
      const built =
        delivery.type === 'status_changed'
          ? buildStatus(delivery, context)
          : delivery.type === 'info_reminder' || delivery.type === 'info_overdue'
            ? buildInfoDeadline(delivery, context)
            : buildActivity(delivery, context);
      if (!built) return;
      const result = await sendMailLogged(
        supabase,
        { to: delivery.target.emails, subject: built.subject, html: built.html },
        { template: `notification_${built.type}`, notificationType: built.type, practiceId: built.practiceId, recipientName: delivery.target.name },
      );
      if (result.success) {
        summary.emails += 1;
        for (const event of delivery.events) sentFor.add(event.id);
      } else {
        summary.failed += 1;
        console.error('notifiche: email non inviata:', result.error);
        for (const event of delivery.events) failedFor.set(event.id, result.error ?? 'errore sconosciuto');
      }
    });

    // Reached nobody: try again on the next run. Reached somebody: done (the failures are in the email log).
    const unsent = claimed.filter((event) => failedFor.has(event.id) && !sentFor.has(event.id));
    const byReason = new Map<string, QueuedEvent[]>();
    for (const event of unsent) {
      const reason = failedFor.get(event.id) ?? 'errore sconosciuto';
      byReason.set(reason, [...(byReason.get(reason) ?? []), event]);
    }
    for (const [reason, events] of byReason) {
      await releaseEvents(supabase, events, reason);
      summary.released += events.filter((event) => event.attempts + 1 < MAX_ATTEMPTS).length;
    }
  } catch (error) {
    // Nothing was decided: all the events go back in the queue.
    const message = error instanceof Error ? error.message : 'errore sconosciuto';
    console.error('notifiche:', message);
    await releaseEvents(supabase, claimed, message);
    summary.released += claimed.filter((event) => event.attempts + 1 < MAX_ATTEMPTS).length;
  }
}

/**
 * Sends the emails for the events waiting in the queue. Safe to call from anywhere and as often as
 * needed: it does nothing when the queue is empty, and a failure never reaches the caller.
 */
export async function dispatchNotifications(supabase: SupabaseClient): Promise<DispatchSummary> {
  const summary: DispatchSummary = { claimed: 0, emails: 0, failed: 0, released: 0, expired: 0 };
  if (getMailProvider() === 'none') return { ...summary, skipped: 'no_mail_provider' };

  try {
    const cutoff = new Date(Date.now() - EVENT_LIFETIME_MS).toISOString();
    const { data: expired } = await supabase
      .from('notification_events')
      .update({ processed_at: new Date().toISOString(), last_error: 'expired' })
      .is('processed_at', null)
      .lt('created_at', cutoff)
      .select('id');
    summary.expired = expired?.length ?? 0;

    const claimed = await claimEvents(supabase);
    summary.claimed = claimed.length;
    if (claimed.length > 0) await sendAll(supabase, claimed, summary);
  } catch (error) {
    console.error('notifiche:', error instanceof Error ? error.message : error);
  }
  return summary;
}

/**
 * Changes made by the server for a signed-in user (an administrator moving a practice from the portal)
 * reach the database with the service role, so the queue cannot tell who acted. This names them, so the
 * person is not written to about their own action.
 */
export async function attributeQueuedEvents(supabase: SupabaseClient, practiceId: string, actorId: string | null | undefined, since: Date) {
  if (!actorId) return;
  const { error } = await supabase
    .from('notification_events')
    .update({ actor_id: actorId })
    .eq('practice_id', practiceId)
    .is('actor_id', null)
    .is('processed_at', null)
    .gte('created_at', new Date(since.getTime() - 15_000).toISOString());
  if (error) console.error('notifiche: autore non registrato:', error.message);
}

/** Names the API client that sent a practice in (no signed-in person acted), for the email to the administrators. */
export async function labelQueuedEvents(supabase: SupabaseClient, practiceId: string, source: string) {
  const label = source.trim().slice(0, 100);
  if (!label) return;
  const { data } = await supabase.from('notification_events').select('id, payload').eq('practice_id', practiceId).is('actor_id', null).is('processed_at', null);
  for (const row of (data ?? []) as Array<{ id: string; payload: Record<string, unknown> | null }>) {
    const { error } = await supabase.from('notification_events').update({ payload: { ...(row.payload ?? {}), source: label } }).eq('id', row.id);
    if (error) console.error('notifiche: origine non registrata:', error.message);
  }
}

const SAMPLE_NOTE: Record<Language, string> = {
  it: "Questa è un'email di prova: le notifiche del portale avranno questo aspetto.",
  en: 'This is a test email: the portal notifications will look like this.',
  zh: '这是一封测试邮件：门户通知将以此样式显示。',
};

/** A sample notification to the addresses chosen for a user, so the administrator can check they arrive. */
export async function sendNotificationSample(supabase: SupabaseClient, userId: string): Promise<{ sent: boolean; to?: string[]; reason?: string }> {
  if (getMailProvider() === 'none') return { sent: false, reason: 'Nessun servizio email configurato su Vercel (GMAIL_USER e GMAIL_APP_PASSWORD oppure RESEND_API_KEY)' };
  const { data: profile } = await supabase.from('profiles').select('id, full_name, email, language').eq('id', userId).maybeSingle();
  if (!profile) return { sent: false, reason: 'Utente non trovato' };
  const { data: settings } = await supabase.from('user_notification_settings').select('notification_emails').eq('user_id', userId).maybeSingle();

  const chosen = ((settings?.notification_emails ?? []) as string[]).map((address) => address.trim()).filter(isEmailAddress);
  const to = unique((chosen.length > 0 ? chosen : isEmailAddress(profile.email) ? [String(profile.email).trim()] : []).map((address) => address.toLowerCase()));
  if (to.length === 0) return { sent: false, reason: "L'utente non ha un indirizzo email" };

  const language = toLanguage(profile.language);
  const copy = copyFor(language);
  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const details: StatusDetails = { dueDate: formatDate(due, language) };
  const example: PracticeInfo = { id: 'sample', number: 'PR-2026-0001', type: 'auto', client: 'Mario Rossi', ownerName: null };
  const subject = `[${language === 'it' ? 'Prova' : language === 'zh' ? '测试' : 'Test'}] ${copy.statusSubject(example.number, 'deliberata')}`;
  const html = renderEmail({
    language,
    title: subject,
    paragraphs: [copy.greeting(String(profile.full_name ?? '').trim()), SAMPLE_NOTE[language], cap(copy.statusSentence.deliberata(copy.label(example), details)), copy.statusAction.deliberata(details)],
    button: { label: copy.buttonMany, url: `${portalUrl()}/practices` },
    footer: copy.footer,
  });
  const result = await sendMailLogged(supabase, { to, subject, html }, { template: 'notification_sample', recipientName: String(profile.full_name ?? '') });
  return result.success ? { sent: true, to } : { sent: false, reason: result.error ?? 'Invio non riuscito' };
}
