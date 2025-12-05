/**
 * Vercel Serverless Function - Cron Job Email Sender
 * 
 * Questo endpoint viene chiamato automaticamente ogni ora da Vercel Cron
 * per inviare le email di notifica scadenze in attesa.
 * 
 * Configurazione Vercel Cron in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron-send-emails",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Configurazione
const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY;
const EMAIL_FROM = process.env.VITE_EMAIL_FROM || 'notifiche@tecnomga.com';
const EMAIL_FROM_NAME = process.env.VITE_EMAIL_FROM_NAME || 'Tecno Advance MGA';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key-here';

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
function verifyCronAuth(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization;
  
  // Vercel Cron invia un header specifico
  if (req.headers['x-vercel-cron']) {
    return true;
  }
  
  // Fallback: verifica secret
  if (authHeader === `Bearer ${CRON_SECRET}`) {
    return true;
  }
  
  return false;
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
    throw new Error(`Failed to fetch notifications: ${response.statusText}`);
  }

  return await response.json();
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
          <p>Ti ricordiamo che la tua polizza <strong>{{practice_type}}</strong> (N. {{practice_number}}) scadrà tra <strong>90 giorni</strong>, il <strong>{{policy_end_date}}</strong>.</p>
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
          <p>La tua polizza <strong>{{practice_type}}</strong> (N. {{practice_number}}) scadrà tra <strong>60 giorni</strong>, il <strong>{{policy_end_date}}</strong>.</p>
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
          <p>La tua polizza <strong>{{practice_type}}</strong> (N. {{practice_number}}) scadrà tra <strong>30 giorni</strong>, il <strong>{{policy_end_date}}</strong>.</p>
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
          <p><strong style="color: #ef4444; font-size: 18px;">La tua polizza scade tra 7 giorni!</strong></p>
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
    year: 'numeric'
  });

  let rendered = template;
  rendered = rendered.replace(/\{\{client_name\}\}/g, data.client_name || 'Cliente');
  rendered = rendered.replace(/\{\{practice_number\}\}/g, data.practice_number || 'N/A');
  rendered = rendered.replace(/\{\{practice_type\}\}/g, data.practice_type || 'N/A');
  rendered = rendered.replace(/\{\{policy_end_date\}\}/g, policyEndDate);
  rendered = rendered.replace(/\{\{days_until_expiry\}\}/g, data.days_until_expiry.toString());
  rendered = rendered.replace(/\{\{agent_name\}\}/g, data.agent_name || 'Il tuo Agente');
  rendered = rendered.replace(/\{\{agent_email\}\}/g, data.agent_email || '');
  rendered = rendered.replace(/\{\{agent_phone\}\}/g, data.agent_phone || '');
  rendered = rendered.replace(/\{\{current_year\}\}/g, currentYear);

  return rendered;
}

/**
 * Genera subject email
 */
function getEmailSubject(notificationType: string, practiceType: string): string {
  const subjectMap: Record<string, string> = {
    '90_days': `Promemoria: La tua polizza ${practiceType} scade tra 90 giorni`,
    '60_days': `Promemoria Importante: La tua polizza ${practiceType} scade tra 60 giorni`,
    '30_days': `Urgente: La tua polizza ${practiceType} scade tra 30 giorni - Azione Richiesta`,
    '7_days': `🚨 URGENTE: La tua polizza ${practiceType} scade tra 7 giorni - Contatta subito il tuo agente`,
  };

  return subjectMap[notificationType] || `Promemoria scadenza polizza ${practiceType}`;
}

/**
 * Invia email tramite Resend
 */
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: JSON.stringify(errorData) };
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Marca notifica come inviata
 */
async function markNotificationSent(notificationId: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase configuration missing');
  }

  await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_email_notification_sent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ p_notification_id: notificationId }),
  });
}

/**
 * Log invio email
 */
async function logEmail(notification: PendingNotification, subject: string, status: string, emailId?: string, error?: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return;
  }

  await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_email_sent`, {
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
    }),
  });
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
        const subject = getEmailSubject(notification.notification_type, notification.practice_type);

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
