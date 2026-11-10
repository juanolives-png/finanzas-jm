// ─── Cifras del tablero ──────────────────────────────────────────────────────
// Desde el libro diario + la categoría de cada cuenta. Misma lógica que el P&L de Huerta:
//   signo: haber − debe (positivo ingreso, negativo egreso), como el "Detalle por Centro de Costos" de Colppy
//   contribución = ingresos − costos operativos
//   EBITDA       = contribución − estructura
//   resultado    = EBITDA − impuestos − financieros − sin clasificar
//   el circuito de IVA y las inversiones van aparte (no tocan el resultado)
//   las patrimoniales marcadas "solo debe" (préstamos, aportes) entran solo con su debe
import { db } from "./db";
import type { Category } from "./categories";

export type MonthRow = {
  month: string; partial: boolean;
  ingresos: number; costos: number; estructura: number; impuestos: number; financieros: number; sinClasificar: number;
  contribucion: number; ebitda: number; resultado: number;
  inversiones: number; circuitoIva: number; cajaNeta: number;
};
export type DashboardData = {
  hasData: boolean;
  months: MonthRow[];
  topGastos: { code: string; name: string; category: string; amount: number }[];
  lastEntry: string | null;
  futureEntries: number;
  toReview: number;
  unclassified: { code: string; name: string; amount: number }[];
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function dashboardData(companyId: string): Promise<DashboardData> {
  const now = new Date(Date.now() - 3 * 3_600_000); // hora argentina
  const today = ymd(now);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const rows = await db.$queryRaw<{ m: string; account: string; d: number; c: number }[]>`
    SELECT to_char(date, 'YYYY-MM') AS m, account,
           COALESCE(SUM(CASE WHEN dc = 'D' THEN amount END), 0)::float8 AS d,
           COALESCE(SUM(CASE WHEN dc = 'C' THEN amount END), 0)::float8 AS c
    FROM ledger_entries WHERE company_id = ${companyId} AND date >= ${from}
    GROUP BY 1, 2`;
  const accounts = await db.ledgerAccount.findMany({ where: { companyId } });
  const acc = new Map(accounts.map((a) => [a.code, a]));

  const keys: string[] = [];
  for (let i = 0; i < 12; i++) keys.push(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  const current = today.slice(0, 7);
  const empty = (month: string): MonthRow => ({ month, partial: month === current, ingresos: 0, costos: 0, estructura: 0, impuestos: 0, financieros: 0, sinClasificar: 0, contribucion: 0, ebitda: 0, resultado: 0, inversiones: 0, circuitoIva: 0, cajaNeta: 0 });
  const byMonth = new Map(keys.map((k) => [k, empty(k)]));
  const lastClosed = keys[keys.length - 2];
  const gastos = new Map<string, number>();
  const unclassified = new Map<string, number>();

  for (const r of rows) {
    const m = byMonth.get(r.m);
    if (!m) continue;
    const a = acc.get(r.account);
    const first = r.account[0];
    const isResultAccount = first === "4" || first === "5" || first === "6";
    // Categorías de la primera versión (COSTO/GASTO): se leen como costos operativos hasta re-aplicar la plantilla
    const LEGACY: Record<string, Category> = { COSTO: "COSTO_VARIABLE", GASTO: "COSTO_VARIABLE" };
    const cat = (a?.category ? LEGACY[a.category] ?? a.category : null) as Category | null;
    // signo de gestión: haber − debe; las "solo debe" entran solo con el debe (como egreso)
    const v = a?.debitOnly ? -r.d : r.c - r.d;
    if (!cat) {
      if (!isResultAccount) continue; // patrimonial sin categoría: no es del resultado
      m.sinClasificar += -v;
      unclassified.set(r.account, (unclassified.get(r.account) ?? 0) + Math.abs(v));
      continue;
    }
    if (cat === "PATRIMONIAL") continue;
    switch (cat) {
      case "INGRESO": m.ingresos += v; break;
      case "COSTO_VARIABLE": m.costos += -v; break;
      case "ESTRUCTURA": m.estructura += -v; break;
      case "IMPUESTO": m.impuestos += -v; break;
      case "FINANCIERO": m.financieros += -v; break;
      case "INVERSION": m.inversiones += -v; break;
      case "CIRCUITO_IVA": m.circuitoIva += v; break;
      case "CAJA_BANCO": m.cajaNeta += r.d - r.c; break;
    }
    if (r.m === lastClosed && ["COSTO_VARIABLE", "ESTRUCTURA", "IMPUESTO", "FINANCIERO"].includes(cat)) {
      gastos.set(r.account, (gastos.get(r.account) ?? 0) - v);
    }
  }
  for (const m of byMonth.values()) {
    m.contribucion = m.ingresos - m.costos;
    m.ebitda = m.contribucion - m.estructura;
    m.resultado = m.ebitda - m.impuestos - m.financieros - m.sinClasificar;
  }

  // Última fecha contable hasta hoy (los asientos con fecha futura —cheques diferidos, vencimientos— se cuentan aparte)
  const last = await db.ledgerEntry.findFirst({ where: { companyId, date: { lte: new Date(`${today}T23:59:59Z`) } }, orderBy: { date: "desc" }, select: { date: true } });
  const futureEntries = await db.ledgerEntry.count({ where: { companyId, date: { gt: new Date(`${today}T23:59:59Z`) } } });

  return {
    hasData: rows.length > 0,
    months: [...byMonth.values()],
    topGastos: [...gastos.entries()].filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([code, amount]) => ({ code, name: acc.get(code)?.name ?? code, category: acc.get(code)?.category ?? "", amount })),
    lastEntry: last ? ymd(last.date) : null,
    futureEntries,
    toReview: accounts.filter((a) => !a.confirmed && a.category && a.category !== "PATRIMONIAL" && a.category !== "CAJA_BANCO").length,
    unclassified: [...unclassified.entries()].sort((a, b) => b[1] - a[1]).map(([code, amount]) => ({ code, name: acc.get(code)?.name ?? code, amount })),
  };
}
