// Casilla de envío y datos de cobro del cliente. La contraseña se guarda encriptada y nunca vuelve al navegador.
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { errorResponse, requireSession } from "@/lib/auth";

export async function GET() {
  try {
    const s = await requireSession();
    const c = await db.mailConfig.findUnique({ where: { tenantId: s.tenantId } });
    const { smtpPassEnc, ...rest } = c ?? ({} as any);
    return Response.json({ config: c ? { ...rest, hasPassword: !!smtpPassEnc } : null });
  } catch (e) { return errorResponse(e); }
}

export async function PUT(req: Request) {
  try {
    const s = await requireSession();
    const b = (await req.json()) as Record<string, any>;
    const data = {
      smtpHost: String(b.smtpHost || "smtp.gmail.com").trim(), smtpPort: Number(b.smtpPort) || 465,
      smtpUser: String(b.smtpUser ?? "").trim() || null, fromName: String(b.fromName ?? "").trim() || null,
      replyTo: String(b.replyTo ?? "").trim() || null, ccDefault: String(b.ccDefault ?? "").trim() || null,
      signature: String(b.signature ?? "").trim() || null, bankInfo: String(b.bankInfo ?? "").trim() || null,
      brandColor: /^#[0-9a-f]{6}$/i.test(b.brandColor) ? b.brandColor : "#131c4a",
      // la contraseña sólo se cambia si viene una nueva (Gmail la muestra con espacios: se sacan)
      ...(b.smtpPass ? { smtpPassEnc: encrypt(String(b.smtpPass).replace(/\s+/g, "")) } : {}),
    };
    await db.mailConfig.upsert({ where: { tenantId: s.tenantId }, create: { tenantId: s.tenantId, ...data }, update: data });
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
