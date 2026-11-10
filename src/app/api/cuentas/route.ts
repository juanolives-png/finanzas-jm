// Plan de cuentas de una empresa con su categoría y lo que movió en los últimos 12 meses.
// PATCH: el cliente cambia/confirma categorías (de a una o varias juntas).
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { CATEGORY_KEYS } from "@/lib/categories";

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const id = new URL(req.url).searchParams.get("company");
    if (!id) throw new HttpError(400, "Falta la empresa");
    const company = await getCompany(s, id);
    const now = new Date(Date.now() - 3 * 3_600_000);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const totals = await db.$queryRaw<{ account: string; d: number; c: number; n: bigint }[]>`
      SELECT account, COALESCE(SUM(CASE WHEN dc='D' THEN amount END),0)::float8 AS d,
             COALESCE(SUM(CASE WHEN dc='C' THEN amount END),0)::float8 AS c, COUNT(*)::bigint AS n
      FROM ledger_entries WHERE company_id = ${company.id} AND date >= ${from} GROUP BY account`;
    const t = new Map(totals.map((x) => [x.account, x]));
    const accounts = (await db.ledgerAccount.findMany({ where: { companyId: company.id }, orderBy: { code: "asc" } })).map((a) => {
      const x = t.get(a.code);
      return {
        code: a.code, name: a.name, category: a.category, debitOnly: a.debitOnly, source: a.source, aiReason: a.aiReason, confirmed: a.confirmed,
        debe: x?.d ?? 0, haber: x?.c ?? 0, movimientos: Number(x?.n ?? 0),
      };
    });
    return Response.json({ company: { id: company.id, name: company.name }, template: company.template ?? "general", accounts, aiEnabled: !!process.env.ANTHROPIC_API_KEY });
  } catch (e) { return errorResponse(e); }
}

const Patch = z.object({
  company: z.string(),
  updates: z.array(z.object({
    code: z.string(),
    category: z.enum(CATEGORY_KEYS as [string, ...string[]]).nullable().optional(),
    debitOnly: z.boolean().optional(),
    confirmed: z.boolean().optional(),
  })).min(1).max(2000),
});

export async function PATCH(req: Request) {
  try {
    const s = await requireSession();
    const p = Patch.safeParse(await req.json());
    if (!p.success) throw new HttpError(400, "Datos inválidos");
    const company = await getCompany(s, p.data.company);
    let n = 0;
    for (const u of p.data.updates) {
      const data: Record<string, unknown> = {};
      if (u.category !== undefined) { data.category = u.category; data.source = "cliente"; data.confirmed = true; }
      if (u.debitOnly !== undefined) data.debitOnly = u.debitOnly;
      if (u.confirmed !== undefined) data.confirmed = u.confirmed;
      const r = await db.ledgerAccount.updateMany({ where: { companyId: company.id, code: u.code }, data });
      n += r.count;
    }
    return Response.json({ ok: true, updated: n });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
