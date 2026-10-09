/**
 * Vercel Serverless Function - Cron Job Email Sender
 *
 * Vercel Cron lo chiama ogni giorno alle 09:00 UTC (vercel.json) per inviare ai
 * clienti i promemoria di scadenza polizza (90, 60, 30 e 7 giorni).
 *
 * Quali promemoria partono lo decide il database (get_pending_email_notifications,
 * migrazione 20261009_expiry_email_functions.sql): solo quelli scaduti da non piu'
 * di 7 giorni, su pratiche attive non VIES, un'email per pratica al giorno.
 * Ogni invio viene registrato in email_logs.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PRACTICE_TYPE_LABELS } from '../src/lib/practiceSummary.js';
import { escapeHtml, getMailProvider, sendMail } from './_lib/mailer.js';

// Configurazione
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

interface PendingNotification {
  notification_id: string;
  practice_id: string;
  practice_number: string;
  practice_type: string;
  policy_end_date: string;
  days_until_expiry: number;
  notification_type: '90_days' | '60_days' | '30_days' | '7_days';
  notification_date: string;
  client_name: string;
  client_email: string;
  agent_name: string;
  agent_email: string;
  agent_phone: string;
}

/**
 * Verifica autenticazione cron job
 */
// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the variable is set.
// Without it the endpoint stays closed: no default secret, no trusted header.
function verifyCronAuth(req: VercelRequest): boolean {
  return Boolean(CRON_SECRET) && req.headers.authorization === `Bearer ${CRON_SECRET}`;
}

/**
 * Recupera notifiche in attesa dal database
 */
async function getPendingNotifications(): Promise<PendingNotification[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase configuration missing');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_pending_email_notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch notifications: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

function practiceTypeLabel(practiceType: string): string {
  return PRACTICE_TYPE_LABELS[practiceType] || practiceType;
}

// Il promemoria puo' partire qualche giorno dopo la sua data (cron saltato):
// testo e oggetto riportano i giorni che mancano davvero alla scadenza.
function daysText(days: number): string {
  return days === 1 ? '1 giorno' : `${days} giorni`;
}

/**
 * Carica template email (versione semplificata per serverless)
 */
function getEmailTemplate(notificationType: string): string {
  // In produzione, questi template dovrebbero essere caricati dal database
  // Per ora, usiamo template inline semplificati
  
  const templates: Record<string, string> = {
    '90_days': `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">Promemoria Scadenza Polizza</h2>
          <p>Gentile <strong>{{client_name}}</strong>,</p>
          <p>Ti ricordiamo che la tua polizza <strong>{{practice_type}}</strong> (N. {{practice_number}}) scadrà tra <strong>{{days_text}}</strong>, il <strong>{{policy_end_date}}</strong>.</p>
          <p>Il tuo agente <strong>{{agent_name}}</strong> ti contatterà a breve per il rinnovo.</p>
          <p>Per qualsiasi informazione, contatta:<br>
          📧 {{agent_email}}<br>
          📞 {{agent_phone}}</p>
          <hr style="margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">© {{current_year}} Tecno Advance MGA</p>
        </div>
      </body>
      </html>
    `,
    '60_days': `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b;">Promemoria Importante - Scadenza Polizza</h2>
          <p>Gentile <strong>{{client_name}}</strong>,</p>
          <p>La tua polizza <strong>{{practice_type}}</strong> (N. {{practice_number}}) scadrà tra <strong>{{days_text}}</strong>, il <strong>{{policy_end_date}}</strong>.</p>
          <p>Ti invitiamo a contattare il tuo agente <strong>{{agent_name}}</strong> per valutare il rinnovo.</p>
          <p>Contatti:<br>
          📧 {{agent_email}}<br>
          📞 {{agent_phone}}</p>
          <hr style="margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">© {{current_year}} Tecno Advance MGA</p>
        </div>
      </body>
      </html>
    `,
    '30_days': `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border-left: 4px solid #f97316;">
          <h2 style="color: #f97316;">⚠️ URGENTE - Scadenza Polizza Imminente</h2>
          <p>Gentile <strong>{{client_name}}</strong>,</p>
          <p>La tua polizza <strong>{{practice_type}}</strong> (N. {{practice_number}}) scadrà tra <strong>{{days_text}}</strong>, il <strong>{{policy_end_date}}</strong>.</p>
          <p><strong>È necessario agire ora</strong> per evitare interruzioni nella copertura.</p>
          <p>Contatta urgentemente il tuo agente <strong>{{agent_name}}</strong>:<br>
          📧 {{agent_email}}<br>
          📞 {{agent_phone}}</p>
          <hr style="margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">© {{current_year}} Tecno Advance MGA</p>
        </div>
      </body>
      </html>
    `,
    '7_days': `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 3px solid #ef4444; background-color: #fef2f2;">
          <h2 style="color: #ef4444;">🚨 URGENTISSIMO - Polizza in Scadenza</h2>
          <p>Gentile <strong>{{client_name}}</strong>,</p>
          <p><strong style="color: #ef4444; font-size: 18px;">La tua polizza scade tra {{days_text}}!</strong></p>
          <p>Polizza: <strong>{{practice_type}}</strong> (N. {{practice_number}})<br>
          Data scadenza: <strong>{{policy_end_date}}</strong></p>
          <p><strong>AZIONE IMMEDIATA RICHIESTA</strong> - Contatta subito il tuo agente:</p>
          <p style="background: white; padding: 15px; border-radius: 5px;">
          <strong>{{agent_name}}</strong><br>
          📧 {{agent_email}}<br>
          📞 {{agent_phone}}</p>
          <hr style="margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">© {{current_year}} Tecno Advance MGA</p>
        </div>
      </body>
      </html>
    `,
  };

  return templates[notificationType] || templates['90_days'];
}

/**
 * Renderizza template con dati
 */
function renderTemplate(template: string, data: PendingNotification): string {
  const currentYear = new Date().getFullYear().toString();
  const policyEndDate = new Date(data.policy_end_date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

  // I valori arrivano dalle pratiche caricate dagli utenti: escape prima di finire nell'HTML.
  const values: Record<string, string> = {
    client_name: data.client_name || 'Cliente',
    practice_number: data.practice_number || 'N/A',
    practice_type: practiceTypeLabel(data.practice_type) || 'N/A',
    policy_end_date: policyEndDate,
    days_until_expiry: data.days_until_expiry.toString(),
    days_text: daysText(data.days_until_expiry),
    agent_name: data.agent_name || 'Il tuo Agente',
    agent_email: data.agent_email || '',
    agent_phone: data.agent_phone || '',
    current_year: currentYear,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    key in values ? escapeHtml(values[key]) : placeholder
  );
}

/**
 * Genera subject email
 */
function getEmailSubject(notificationType: string, practiceType: string, daysUntilExpiry: number): string {
  const label = practiceTypeLabel(practiceType);
  const days = daysText(daysUntilExpiry);
  const subjectMap: Record<string, string> = {
    '90_days': `Promemoria: La tua polizza ${label} scade tra ${days}`,
    '60_days': `Promemoria Importante: La tua polizza ${label} scade tra ${days}`,
    '30_days': `Urgente: La tua polizza ${label} scade tra ${days} - Azione Richiesta`,
    '7_days': `🚨 URGENTE: La tua polizza ${label} scade tra ${days} - Contatta subito il tuo agente`,
  };

  return subjectMap[notificationType] || `Promemoria scadenza polizza ${label}`;
}

/**
 * Invia email dal canale configurato (Gmail o Resend, vedi api/_lib/mailer.ts)
 */
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendMail({ to, subject, html });
}

/**
 * Marca notifica come inviata
 */
async function markNotificationSent(notificationId: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase configuration missing');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_email_notification_sent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ p_notification_id: notificationId }),
  });

  // Se la notifica non risulta inviata il cron la rispedirebbe domani: va segnalato.
  if (!response.ok) {
    throw new Error(`Failed to mark notification ${notificationId}: ${response.status} ${await response.text()}`);
  }
}

/**
 * Log invio email
 */
async function logEmail(notification: PendingNotification, subject: string, status: string, emailId?: string, error?: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_email_sent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      p_practice_id: notification.practice_id,
      p_notification_id: notification.notification_id,
      p_recipient_email: notification.client_email,
      p_recipient_name: notification.client_name,
      p_subject: subject,
      p_template_used: `expiry_${notification.notification_type}`,
      p_notification_type: notification.notification_type,
      p_resend_email_id: emailId || null,
      p_status: status,
      p_error_message: error || null,
    }),
  });

  if (!response.ok) {
    console.error(`Email log not saved for ${notification.notification_id}: ${response.status} ${await response.text()}`);
  }
}

/**
 * Handler principale
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verifica metodo
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verifica autenticazione
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🔄 Starting email notification cron job...');

  // Senza un canale di invio non si prova nemmeno: i promemoria restano da inviare
  // e non finiscono nel registro come falliti.
  if (getMailProvider() === 'none') {
    return res.status(200).json({
      success: false,
      message: 'Nessun servizio email configurato: promemoria non inviati',
      total: 0,
      sent: 0,
      failed: 0,
    });
  }

  try {
    // 1. Recupera notifiche in attesa
    const notifications = await getPendingNotifications();
    console.log(`📧 Found ${notifications.length} pending notifications`);

    if (notifications.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending notifications',
        total: 0,
        sent: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let failed = 0;

    // 2. Invia email una alla volta
    for (const notification of notifications) {
      try {
        // Carica e renderizza template
        const template = getEmailTemplate(notification.notification_type);
        const html = renderTemplate(template, notification);
        const subject = getEmailSubject(notification.notification_type, notification.practice_type, notification.days_until_expiry);

        // Invia email
        const result = await sendEmail(notification.client_email, subject, html);

        // Log risultato
        await logEmail(notification, subject, result.success ? 'sent' : 'failed', result.id, result.error);

        if (result.success) {
          // Marca come inviata
          await markNotificationSent(notification.notification_id);
          sent++;
          console.log(`✅ Email sent to ${notification.client_email} (ID: ${result.id})`);
        } else {
          failed++;
          console.error(`❌ Failed to send email to ${notification.client_email}: ${result.error}`);
        }

        // Pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failed++;
        console.error(`❌ Error processing notification ${notification.notification_id}:`, error);
      }
    }

    console.log(`✅ Cron job completed: ${sent} sent, ${failed} failed`);

    return res.status(200).json({
      success: true,
      message: 'Email processing completed',
      total: notifications.length,
      sent,
      failed,
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
