// ─── Cartera de clientes: churn, recompra, concentración y días reales de cobro ──
// Todo sale de las facturas de Colppy (no hay que cargar nada). Es una función pura: la usa la pantalla
// (con los comprobantes de la base) y la vista previa del inicio (con los de la empresa demo).
//   · Activo: compró en los últimos N días (N lo elige el cliente: 60, 90, 120 o 180)
//   · Perdido: era cliente y pasaron N días desde su última compra
//   · Churn del período: perdidos de los últimos 90 días ÷ activos hace 90 días
//   · Recompra: de los que compraron en los últimos 12 meses, cuántos compraron en 2 meses distintos o más
//   · Días reales de cobro: de la factura al cobro (fecha del recibo en Colppy), ponderado por importe
//   · DSO / DPO: saldo ÷ (ventas o compras de los últimos 90 días ÷ 90), el cálculo clásico

export type AnDoc = {
  kind: string; partyId: string; partyName: string; docType: string;
  date: Date; dueDate: Date | null; total: number; pending: number; paidAt: Date | null;
};

const DAY = 86_400_000;
const days = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);
const ym = (d: Date) => d.toISOString().slice(0, 7);

export type ClientRow = {
  id: string; name: string; first: string; last: string; daysSince: number; invoices: number; months: number;
  revenue12: number; avgMonthly: number; interval: number | null; pending: number;
  realDays: number | null; agreedDays: number | null; lateDays: number | null; paidDocs: number;
};

export function customerAnalytics(docs: AnDoc[], today: Date, lostDays = 90) {
  const sales = docs.filter((d) => d.kind === "venta");
  const buys = sales.filter((d) => (d.docType === "FAV" || d.docType === "NDV") && d.total > 0);
  const y1 = new Date(today.getTime() - 365 * DAY);
  const q = new Date(today.getTime() - 90 * DAY);

  // ── Por cliente ──
  const map = new Map<string, { name: string; dates: Date[]; revenue12: number; pending: number; w: number; real: number; agreed: number; late: number; paid: number }>();
  const get = (d: AnDoc) => { let r = map.get(d.partyId); if (!r) { r = { name: d.partyName, dates: [], revenue12: 0, pending: 0, w: 0, real: 0, agreed: 0, late: 0, paid: 0 }; map.set(d.partyId, r); } return r; };
  for (const d of sales) {
    const r = get(d);
    if (d.date >= y1) r.revenue12 += d.total;
    if (d.pending > 0) r.pending += d.pending;
  }
  for (const d of buys) {
    const r = get(d);
    r.dates.push(d.date);
    if (d.paidAt) {
      r.w += d.total; r.paid++;
      r.real += d.total * Math.max(0, days(d.paidAt, d.date));
      r.agreed += d.total * Math.max(0, days(d.dueDate ?? d.date, d.date));
      r.late += d.total * days(d.paidAt, d.dueDate ?? d.date);
    }
  }

  const rows: ClientRow[] = [];
  for (const [id, r] of map) {
    if (!r.dates.length) continue;
    r.dates.sort((a, b) => a.getTime() - b.getTime());
    const first = r.dates[0], last = r.dates[r.dates.length - 1];
    const monthsSet = new Set(r.dates.filter((d) => d >= y1).map(ym));
    const distinctMonths = [...new Set(r.dates.map(ym))].sort();
    const interval = distinctMonths.length > 1 ? Math.round(days(last, first) / (distinctMonths.length - 1)) : null;
    rows.push({
      id, name: r.name, first: first.toISOString().slice(0, 10), last: last.toISOString().slice(0, 10), daysSince: days(today, last),
      invoices: r.dates.length, months: monthsSet.size, revenue12: r.revenue12, avgMonthly: monthsSet.size ? r.revenue12 / 12 : 0, interval, pending: r.pending,
      realDays: r.w ? Math.round(r.real / r.w) : null, agreedDays: r.w ? Math.round(r.agreed / r.w) : null, lateDays: r.w ? Math.round(r.late / r.w) : null, paidDocs: r.paid,
    });
  }
  const firstOf = new Map(rows.map((r) => [r.id, new Date(r.first)]));
  const datesOf = new Map([...map].map(([id, r]) => [id, r.dates]));
  const activeAt = (id: string, t: Date) => (datesOf.get(id) ?? []).some((d) => d <= t && days(t, d) < lostDays);
  const lostDate = (r: ClientRow) => new Date(new Date(r.last).getTime() + lostDays * DAY);

  // ── Serie de 12 meses: activos al cierre, nuevos y perdidos de cada mes ──
  const series: { month: string; active: number; new: number; lost: number; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const endM = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i + 1, 0));
    const end = endM > today ? today : endM;
    const month = ym(start);
    series.push({
      month,
      active: rows.filter((r) => activeAt(r.id, end)).length,
      new: rows.filter((r) => ym(firstOf.get(r.id)!) === month).length,
      lost: rows.filter((r) => { const l = lostDate(r); return l <= today && ym(l) === month; }).length,
      revenue: sales.filter((d) => ym(d.date) === month).reduce((s, d) => s + d.total, 0),
    });
  }

  // ── Indicadores ──
  const active = rows.filter((r) => r.daysSince < lostDays);
  const activeBefore = rows.filter((r) => activeAt(r.id, q)).length;
  const newQ = rows.filter((r) => firstOf.get(r.id)! > q);
  const lostQ = rows.filter((r) => { const l = lostDate(r); return l > q && l <= today; });
  const bought12 = rows.filter((r) => r.months > 0);
  const repeat = bought12.filter((r) => r.months >= 2);
  const rev12 = rows.reduce((s, r) => s + Math.max(0, r.revenue12), 0);
  const top = [...rows].sort((a, b) => b.revenue12 - a.revenue12);
  const top5 = top.slice(0, 5).reduce((s, r) => s + Math.max(0, r.revenue12), 0);
  // Recurrentes: compraron en cada uno de los últimos 3 meses cerrados
  const last3 = [1, 2, 3].map((k) => ym(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - k, 1))));
  const recurring = rows.filter((r) => last3.every((m) => (datesOf.get(r.id) ?? []).some((d) => ym(d) === m)));
  const recurringMonthly = recurring.reduce((s, r) => s + sales.filter((d) => d.partyId === r.id && last3.includes(ym(d.date))).reduce((a, d) => a + d.total, 0), 0) / 3;

  // En riesgo: activos que hace bastante más que lo habitual que no compran
  const atRisk = active.filter((r) => r.interval !== null && r.invoices >= 3 && r.daysSince > Math.max(r.interval * 1.5, r.interval + 15))
    .sort((a, b) => b.revenue12 - a.revenue12);
  const lost = rows.filter((r) => { const l = lostDate(r); return l <= today && l > y1; }).sort((a, b) => b.revenue12 - a.revenue12);

  // ── Días de cobro ──
  let w = 0, real = 0, agreed = 0, late = 0, paidDocs = 0;
  for (const d of buys) if (d.paidAt) { w += d.total; paidDocs++; real += d.total * Math.max(0, days(d.paidAt, d.date)); agreed += d.total * Math.max(0, days(d.dueDate ?? d.date, d.date)); late += d.total * days(d.paidAt, d.dueDate ?? d.date); }
  const settled = buys.filter((d) => Math.abs(d.pending) <= 1).length;
  const sales90 = sales.filter((d) => d.date > q).reduce((s, d) => s + d.total, 0);
  const receivables = sales.filter((d) => d.pending > 0).reduce((s, d) => s + d.pending, 0);
  const purchases = docs.filter((d) => d.kind === "compra");
  const buys90 = purchases.filter((d) => d.date > q).reduce((s, d) => s + d.total, 0);
  const payables = purchases.filter((d) => d.pending > 0).reduce((s, d) => s + d.pending, 0);

  return {
    lostDays, asOf: today.toISOString().slice(0, 10),
    kpis: {
      active: active.length, activeBefore, new90: newQ.length, lost90: lostQ.length,
      churn: activeBefore ? lostQ.length / activeBefore : 0,
      repeat: bought12.length ? repeat.length / bought12.length : 0,
      top5Share: rev12 ? top5 / rev12 : 0, top1: top[0] ? { name: top[0].name, share: rev12 ? top[0].revenue12 / rev12 : 0 } : null,
      recurring: recurring.length, recurringMonthly,
      realDays: w ? Math.round(real / w) : null, agreedDays: w ? Math.round(agreed / w) : null, lateDays: w ? Math.round(late / w) : null,
      paidCoverage: settled ? paidDocs / settled : 0, paidDocs,
      dso: sales90 > 0 ? Math.round(receivables / (sales90 / 90)) : null,
      dpo: buys90 > 0 ? Math.round(payables / (buys90 / 90)) : null,
      revenue12: rev12, newRevenue90: sales.filter((d) => d.date > q && firstOf.get(d.partyId)! > q).reduce((s, d) => s + d.total, 0),
    },
    series,
    atRisk: atRisk.slice(0, 15),
    lost: lost.slice(0, 15),
    clients: [...rows].filter((r) => r.revenue12 > 0 || r.pending > 0).sort((a, b) => b.revenue12 - a.revenue12),
  };
}
export type CustomerAnalytics = ReturnType<typeof customerAnalytics>;
