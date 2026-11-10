// Elige la plantilla de criterio del cliente y re-propone las cuentas NO confirmadas.
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { TEMPLATES, type TemplateKey } from "@/lib/categories";
import { applyTemplate } from "@/lib/sync";

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const { company: id, template } = (await req.json()) as { company?: string; template?: string };
    if (!id || !template || !(template in TEMPLATES)) throw new HttpError(400, "Plantilla inválida");
    const company = await getCompany(s, id);
    await db.company.update({ where: { id: company.id }, data: { template } });
    const n = await applyTemplate(company.id, template as TemplateKey);
    return Response.json({ ok: true, reproposed: n });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
