// PDF de una factura de venta, tal cual lo genera Colppy (sólo comprobantes electrónicos con CAE).
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { colppyFor, resetColppyFor } from "@/lib/colppySession";
import { docLabel } from "@/lib/mailTemplates";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const u = new URL(req.url);
    const id = u.searchParams.get("company"), docId = u.searchParams.get("doc");
    if (!id || !docId) throw new HttpError(400, "Faltan datos");
    const company = await getCompany(s, id);
    const doc = await db.doc.findFirst({ where: { id: docId, companyId: company.id, kind: "venta" } });
    if (!doc) throw new HttpError(404, "Factura no encontrada");
    let buf: Buffer;
    try { buf = await (await colppyFor(company)).pdf(doc.colppyId); }
    catch (e) {
      resetColppyFor(company.id); // la sesión pudo vencer: se reintenta una vez con una nueva
      try { buf = await (await colppyFor(company)).pdf(doc.colppyId); }
      catch (e2) { throw new HttpError(502, e2 instanceof Error ? e2.message : String(e)); }
    }
    const name = docLabel(doc).replace(/\s+/g, "_") + ".pdf";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
