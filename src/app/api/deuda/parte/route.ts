// Ficha de un cliente / proveedor: comprobantes con saldo + historial de mails. PATCH: corregir el mail.
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { partyDetail, partyKind, type Kind } from "@/lib/deuda";
import { splitEmails } from "@/lib/mail";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const u = new URL(req.url);
    const id = u.searchParams.get("company"), kind = u.searchParams.get("kind") as Kind, party = u.searchParams.get("party");
    if (!id || !party || (kind !== "clientes" && kind !== "proveedores")) throw new HttpError(400, "Faltan datos");
    const company = await getCompany(s, id);
    return Response.json(await partyDetail(company.id, kind, party));
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: Request) {
  try {
    const s = await requireSession();
    const { company: id, kind, party, email } = (await req.json()) as { company?: string; kind?: Kind; party?: string; email?: string };
    if (!id || !party || (kind !== "clientes" && kind !== "proveedores")) throw new HttpError(400, "Faltan datos");
    const company = await getCompany(s, id);
    const clean = splitEmails(email).join(", ") || null;
    if (email && !clean) throw new HttpError(400, "Ese mail no parece válido");
    const where = { companyId_kind_colppyId: { companyId: company.id, kind: partyKind(kind), colppyId: party } };
    const doc = await db.doc.findFirst({ where: { companyId: company.id, partyId: party }, select: { partyName: true } });
    await db.party.upsert({ where, create: { companyId: company.id, kind: partyKind(kind), colppyId: party, name: doc?.partyName ?? party, email: clean, emailManual: true }, update: { email: clean, emailManual: true } });
    return Response.json({ ok: true, email: clean });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
