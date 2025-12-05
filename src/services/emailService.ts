/**
 * Email Service - Resend Integration
 * Servizio per invio automatico email scadenze polizze
 */

import { supabase } from '../lib/supabase';

// Configurazione Resend
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const EMAIL_FROM = import.meta.env.VITE_EMAIL_FROM || 'notifiche@tecnomga.com';
const EMAIL_FROM_NAME = import.meta.env.VITE_EMAIL_FROM_NAME || 'Tecno Advance MGA';

// Tipi
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

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  notification_type: string;
}

interface SendEmailResult {
  success: boolean;
  email_id?: string;
  error?: string;
}

/**
 * Carica un template email HTML dal filesystem
 */
async function loadEmailTemplate(notificationType: string): Promise<string> {
  try {
    const templateMap: Record<string, string> = {
      '90_days': '/src/email-templates/expiry-90-days.html',
      '60_days': '/src/email-templates/expiry-60-days.html',
      '30_days': '/src/email-templates/expiry-30-days.html',
      '7_days': '/src/email-templates/expiry-7-days.html',
    };

    const templatePath = templateMap[notificationType];
    if (!templatePath) {
      throw new Error(`Template not found for notification type: ${notificationType}`);
    }

    // In produzione, i template dovrebbero essere caricati dal database
    // Per ora, usiamo fetch per caricarli
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error('Error loading email template:', error);
    throw error;
  }
}

/**
 * Sostituisce i placeholder nel template con i dati reali
 */
function renderEmailTemplate(
  template: string,
  data: PendingNotification
): string {
  const currentYear = new Date().getFullYear().toString();
  
  // Formatta la data in formato italiano
  const policyEndDate = new Date(data.policy_end_date);
  const formattedDate = policyEndDate.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  let rendered = template;
  rendered = rendered.replace(/\{\{client_name\}\}/g, data.client_name || 'Cliente');
  rendered = rendered.replace(/\{\{practice_number\}\}/g, data.practice_number || 'N/A');
  rendered = rendered.replace(/\{\{practice_type\}\}/g, data.practice_type || 'N/A');
  rendered = rendered.replace(/\{\{policy_end_date\}\}/g, formattedDate);
  rendered = rendered.replace(/\{\{days_until_expiry\}\}/g, data.days_until_expiry.toString());
  rendered = rendered.replace(/\{\{agent_name\}\}/g, data.agent_name || 'Il tuo Agente');
  rendered = rendered.replace(/\{\{agent_email\}\}/g, data.agent_email || '');
  rendered = rendered.replace(/\{\{agent_phone\}\}/g, data.agent_phone || '');
  rendered = rendered.replace(/\{\{current_year\}\}/g, currentYear);

  return rendered;
}

/**
 * Genera l'oggetto email basato sul tipo di notifica
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
 * Invia email tramite Resend API
 */
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string
): Promise<SendEmailResult> {
  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

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
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      email_id: data.id,
    };
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Registra l'invio email nel log
 */
async function logEmailSent(
  notification: PendingNotification,
  subject: string,
  status: string,
  resendEmailId?: string,
  errorMessage?: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_email_sent', {
      p_practice_id: notification.practice_id,
      p_notification_id: notification.notification_id,
      p_recipient_email: notification.client_email,
      p_recipient_name: notification.client_name,
      p_subject: subject,
      p_template_used: `expiry_${notification.notification_type}`,
      p_notification_type: notification.notification_type,
      p_resend_email_id: resendEmailId || null,
      p_status: status,
    });

    if (error) {
      console.error('Error logging email:', error);
    }
  } catch (error) {
    console.error('Error in logEmailSent:', error);
  }
}

/**
 * Marca una notifica come inviata via email
 */
async function markNotificationSent(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_email_notification_sent', {
      p_notification_id: notificationId,
    });

    if (error) {
      console.error('Error marking notification as sent:', error);
    }
  } catch (error) {
    console.error('Error in markNotificationSent:', error);
  }
}

/**
 * Recupera tutte le notifiche in attesa di invio
 */
export async function getPendingEmailNotifications(): Promise<PendingNotification[]> {
  try {
    const { data, error } = await supabase.rpc('get_pending_email_notifications');

    if (error) {
      console.error('Error fetching pending notifications:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPendingEmailNotifications:', error);
    return [];
  }
}

/**
 * Invia una singola email di notifica scadenza
 */
export async function sendExpiryNotificationEmail(
  notification: PendingNotification
): Promise<SendEmailResult> {
  try {
    console.log(`Sending expiry notification email for practice ${notification.practice_number}...`);

    // 1. Carica template
    const template = await loadEmailTemplate(notification.notification_type);

    // 2. Renderizza template con dati
    const html = renderEmailTemplate(template, notification);

    // 3. Genera subject
    const subject = getEmailSubject(notification.notification_type, notification.practice_type);

    // 4. Invia email via Resend
    const result = await sendEmailViaResend(
      notification.client_email,
      subject,
      html
    );

    // 5. Log invio
    await logEmailSent(
      notification,
      subject,
      result.success ? 'sent' : 'failed',
      result.email_id,
      result.error
    );

    // 6. Marca notifica come inviata se successo
    if (result.success) {
      await markNotificationSent(notification.notification_id);
      console.log(`✅ Email sent successfully to ${notification.client_email} (ID: ${result.email_id})`);
    } else {
      console.error(`❌ Failed to send email to ${notification.client_email}: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error('Error in sendExpiryNotificationEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Processa tutte le notifiche in attesa (chiamato dal cron job)
 */
export async function processAllPendingNotifications(): Promise<{
  total: number;
  sent: number;
  failed: number;
}> {
  console.log('🔄 Starting email notification processing...');

  const notifications = await getPendingEmailNotifications();
  console.log(`📧 Found ${notifications.length} pending notifications`);

  if (notifications.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Invia email una alla volta (evita rate limiting)
  for (const notification of notifications) {
    const result = await sendExpiryNotificationEmail(notification);
    
    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Pausa di 1 secondo tra invii per evitare rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`✅ Email processing completed: ${sent} sent, ${failed} failed`);

  return {
    total: notifications.length,
    sent,
    failed,
  };
}

/**
 * Test invio email (per debugging)
 */
export async function testEmailSending(
  recipientEmail: string,
  notificationType: '90_days' | '60_days' | '30_days' | '7_days' = '90_days'
): Promise<SendEmailResult> {
  const testNotification: PendingNotification = {
    notification_id: 'test-' + Date.now(),
    practice_id: 'test-practice',
    practice_number: 'TEST-001',
    practice_type: 'Casa',
    policy_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    days_until_expiry: 90,
    notification_type: notificationType,
    notification_date: new Date().toISOString(),
    client_name: 'Cliente Test',
    client_email: recipientEmail,
    agent_name: 'Agente Test',
    agent_email: 'agente@tecnomga.com',
    agent_phone: '+39 123 456 7890',
  };

  return await sendExpiryNotificationEmail(testNotification);
}
