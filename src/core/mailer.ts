import nodemailer from 'nodemailer';
import { env } from './env';
import { logger } from './logger';

/**
 * Transporte SMTP (Hostinger). Credenciais vêm de env.
 * Substitui o antigo src/server/email.js (que estava vazio).
 */
export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE, // 465 = true
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: MailInput): Promise<void> {
  try {
    const info = await mailer.sendMail({ from: env.MAIL_FROM, to, subject, html, text });
    logger.info({ to, subject, id: info.messageId }, 'e-mail enviado');
  } catch (err) {
    logger.error({ err, to, subject }, 'falha ao enviar e-mail');
    throw err;
  }
}

/* ───────────────── Templates ───────────────── */

const wrap = (title: string, body: string): string => `
<!doctype html><html><body style="margin:0;background:#f4faf6;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0f1f17">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3efe8">
    <div style="background:#0f7a4f;padding:20px 28px;color:#fff;font-weight:700;font-size:18px">OnyLink</div>
    <div style="padding:28px">
      <h2 style="margin:0 0 12px;font-size:20px;color:#0f1f17">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #eef4f0;color:#7a8b82;font-size:12px">
      OnyLink — menos distração, mais negócio.
    </div>
  </div>
</body></html>`;

export function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  return sendMail({
    to,
    subject: 'Código de recuperação de senha — OnyLink',
    text: `Seu código de recuperação é ${code}. Expira em 10 minutos.`,
    html: wrap(
      'Recuperação de senha',
      `<p>Use o código abaixo para redefinir sua senha. Ele expira em 10 minutos.</p>
       <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#0f7a4f;text-align:center;margin:24px 0">${code}</div>
       <p style="color:#7a8b82;font-size:13px">Se não foi você, ignore este e-mail.</p>`,
    ),
  });
}

export function sendWelcomeEmail(to: string, name: string): Promise<void> {
  return sendMail({
    to,
    subject: 'Bem-vindo à OnyLink',
    text: `Olá ${name}, sua conta foi criada.`,
    html: wrap(
      `Olá, ${name}!`,
      `<p>Sua conta na OnyLink foi criada. Comece pelo diagnóstico empresarial gratuito e conecte-se com quem gera oportunidade pro seu negócio.</p>`,
    ),
  });
}
