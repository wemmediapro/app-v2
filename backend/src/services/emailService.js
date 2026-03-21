/**
 * Envoi d’e-mails (nodemailer). Utilisé par la file Bull « email ».
 * Sans SMTP configuré : log uniquement (pas d’erreur bloquante).
 */
const nodemailer = require('nodemailer');
const logger = require('../lib/logger');

let cachedTransporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user) {
    return null;
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user, pass },
    });
  }
  return cachedTransporter;
}

/**
 * @param {{ to: string | string[], subject: string, text?: string, html?: string, from?: string }} opts
 */
async function sendMail(opts) {
  const { to, subject, text, html, from } = opts;
  if (!to || !subject) {
    logger.warn({ event: 'email_send_skipped', reason: 'missing_to_or_subject' });
    return { sent: false, reason: 'missing_fields' };
  }
  const transporter = getTransporter();
  if (!transporter) {
    logger.info({
      event: 'email_queued_no_smtp',
      to: Array.isArray(to) ? to.join(',') : String(to),
      subject,
      message: 'SMTP non configuré — contenu loggé côté serveur (aucun envoi réel).',
    });
    return { sent: false, reason: 'smtp_not_configured' };
  }
  const fromAddr = from || process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: fromAddr,
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    text: text || undefined,
    html: html || undefined,
  });
  logger.info({ event: 'email_sent', to: 'redacted', subject });
  return { sent: true };
}

module.exports = { sendMail, getTransporter };
