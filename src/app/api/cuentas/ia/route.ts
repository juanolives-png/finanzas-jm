// La IA propone categoría para las cuentas con movimiento que no están confirmadas y que la plantilla
// no resolvió (sin categoría o resueltas solo por regla general).
import { db } from "@/lib/db";
import { errorResponse, getCompany, HttpError, requireSession } from "@/lib/auth";
import { suggestCategories } from "@/lib/ai";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const { company: id } = (await req.json()) as { company?: string };
    if (!id) throw new HttpError(400, "Falta la empresa");
    const company = await getCompany(s, id);
    const now = new Date(Date.now() - 3 * 3_600_000);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const totals = await db.$queryRaw<{ account: string; v: number }[]>`
      SELECT account, SUM(amount)::float8 AS v FROM ledger_entries WHERE company_id = ${company.id} AND date >= ${from} GROUP BY account`;
    const moved = new Map(totals.map((t) => [t.account, t.v]));
    const accounts = await db.ledgerAccount.findMany({ where: { companyId: company.id } });
    const pending = accounts.filter((a) => !a.confirmed && moved.has(a.code) && (a.category === null || a.source === "regla"))
      .map((a) => ({ code: a.code, name: a.name, amount12m: moved.get(a.code) ?? 0 }));
    const examples = accounts.filter((a) => a.confirmed && a.category).map((a) => ({ code: a.code, name: a.name, category: a.category! }));
    const out: Awaited<ReturnType<typeof suggestCategories>> = [];
    for (let i = 0; i < pending.length; i += 80) out.push(...(await suggestCategories(pending.slice(i, i + 80), examples)));
    for (const o of out) {
      await db.ledgerAccount.updateMany({ where: { companyId: company.id, code: o.code, confirmed: false }, data: { category: o.category, source: "ia", aiReason: o.reason } });
    }
    return Response.json({ ok: true, revisadas: pending.length, propuestas: out.length });
  } catch (e) { return errorResponse(e); }
}

export const dynamic = "force-dynamic";
