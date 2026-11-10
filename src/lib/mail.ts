// Envío de mails con la casilla de cada cliente (MailConfig). Las plantillas están en mailTemplates.ts.
import nodemailer from "nodemailer";
import { db } from "./db";
import { decrypt } from "./crypto";
export * from "./mailTemplates";

export async function mailConfig(tenantId: string) {
  return db.mailConfig.findUnique({ where: { tenantId } });
}

export async function deliver(tenantId: string, m: { to: string[]; cc: string[]; subject: string; html: string; text: string }) {
  const cfg = await mailConfig(tenantId);
  if (!cfg?.smtpUser || !cfg.smtpPassEnc) throw new Error("Falta configurar la casilla de envío en Configuración → Correo");
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpPort === 465,
    auth: { user: cfg.smtpUser, pass: decrypt(cfg.smtpPassEnc) }, connectionTimeout: 20_000,
  });
  const info = await transporter.sendMail({
    from: cfg.fromName ? `"${cfg.fromName}" <${cfg.smtpUser}>` : cfg.smtpUser,
    replyTo: cfg.replyTo || undefined, to: m.to, cc: m.cc.length ? m.cc : undefined, subject: m.subject, text: m.text, html: m.html,
  });
  return info.messageId as string;
}

