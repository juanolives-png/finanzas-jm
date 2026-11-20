// ─── Números de la vista previa del inicio, sacados de la empresa demo ───────
// El recorrido de /empezar muestra exactamente lo que después se ve adentro en "Distribuidora del Sol":
// mismos clientes, mismas cifras, mismas facturas. Se calcula en el servidor (una vez por día) y viaja
// como datos simples al componente del inicio.
import { ACCOUNTS, buildDemo, CLIENTS, SUPPLIERS } from "./demoData";
import { customerAnalytics } from "./clientes";

export type PvRow = { c: string[]; tone?: "b" | "g" | "w"; detail?: string[][] };
export type PvKpi = [string, string, string?, ("g" | "b" | "w")?];
export type PvSection = { kpis: PvKpi[]; rows?: PvRow[]; cols?: string[]; tip?: string; title?: string };
export type DemoPreview = {
  company: string; monthName: string; prevMonthName: string;
  tiles: Record<string, PvKpi[]>; extra: Record<string, unknown>;
  sections: Record<string, PvSection>;
};

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const M = (n: number) => (n / 1e6).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const $M = (n: number) => `$ ${M(n)} M`;
const $Mr = (n: number) => `$ ${Math.round(n / 1e6).toLocaleString("es-AR")} M`;
const pct = (n: number, d = 0) => `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d })}%`;
const signed = (n: number) => (n < 0 ? "−" : "") + M(Math.abs(n));
const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const DAY = 86_400_000;
const label = (d: { letter?: string | null; number: string }) => `FC-${d.letter ?? ""} ${d.number}`;

let cache: { key: string; value: DemoPreview } | null = null;

export function demoPreview(): DemoPreview {
  const key = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  if (cache?.key === key) return cache.value;
  const value = compute();
  cache = { key, value };
  return value;
}

function compute(): DemoPreview {
  const { today, accounts, ledger, docs, items } = buildDemo("preview");
  const cat = new Map(accounts.map((a) => [a.code, a.category]));
  const accName = new Map(ACCOUNTS.map((a) => [a.code, a.name]));
  const t = today.getTime();
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1));
  const ym = (d: Date) => d.toISOString().slice(0, 7);
  const L = ym(last), P = ym(prev), C = ym(today);
  const E = ledger.map((e) => ({ ...e, date: e.date as Date, amount: Number(e.amount) }));

  // ── P&L por cuenta y mes (signo de gestión: haber − debe) ──
  const byAcc = (month: string) => {
    const m = new Map<string, number>();
    for (const e of E) if (ym(e.date) === month) m.set(e.account, (m.get(e.account) ?? 0) + (e.dc === "C" ? e.amount : -e.amount));
    return m;
  };
  const pl = (month: string) => {
    const a = byAcc(month);
    const sum = (c: string) => [...a].filter(([k]) => cat.get(k) === c).reduce((s, [, v]) => s + v, 0);
    const ingresos = sum("INGRESO"), cmv = -(a.get("511100") ?? 0), operativos = -sum("COSTO_VARIABLE") - cmv;
    const estructura = -sum("ESTRUCTURA"), impuestos = -sum("IMPUESTO"), financieros = -sum("FINANCIERO");
    const ebitda = ingresos - cmv - operativos - estructura;
    return { a, ingresos, cmv, operativos, estructura, impuestos, financieros, ebitda, resultado: ebitda - impuestos - financieros };
  };
  const now = pl(L), before = pl(P);
  const up = (a: number, b: number) => (b ? (a / b - 1) : 0);
  const arrow = (x: number) => `${x >= 0 ? "▲" : "▼"} ${pct(Math.abs(x), Math.abs(x) < 0.1 ? 1 : 0)}`;
  const accRows = (codes: string[]) => codes.map((c) => [accName.get(c) ?? c, signed(now.a.get(c) ?? 0)]).filter((r) => r[1] !== "0,0");

  // Costo de mercadería por proveedor (lo que se compró el mes)
  const cmvBySup = new Map<string, number>();
  for (const d of docs) if (d.kind === "compra" && ym(d.date as Date) === L && d.description === "Costo de mercadería vendida") cmvBySup.set(d.partyName, (cmvBySup.get(d.partyName) ?? 0) + Number(d.total) / 1.21);
  const sups = [...cmvBySup].sort((a, b) => b[1] - a[1]);
  const supTotal = sups.reduce((s, [, v]) => s + v, 0) || 1;
  const cmvDetail = [...sups.slice(0, 2).map(([n, v]) => [n, signed(-now.cmv * (v / supTotal))]), [`Otros ${Math.max(0, sups.length - 2)} proveedores`, signed(-now.cmv * (sups.slice(2).reduce((s, [, v]) => s + v, 0) / supTotal))]];

  // ── Caja ──
  const cashCodes = accounts.filter((a) => a.category === "CAJA_BANCO").map((a) => a.code);
  const bal = (code: string) => E.filter((e) => e.account === code).reduce((s, e) => s + (e.dc === "D" ? e.amount : -e.amount), 0);
  const caja = cashCodes.reduce((s, c) => s + bal(c), 0);
  const week = t - 7 * DAY;
  let entro = 0, salio = 0;
  for (const e of E) if (cashCodes.includes(e.account) && e.date.getTime() > week && e.srcTable !== "AS") { if (e.dc === "D") entro += e.amount; else salio += e.amount; }
  const gastoMes = now.operativos + now.estructura + now.impuestos + now.financieros; // gastos fijos del mes (la mercadería se paga con lo que se vende)

  // ── Deudas ──
  const pend = (k: string) => docs.filter((d) => d.kind === k && Number(d.pending) > 0).map((d) => ({ ...d, due: d.dueDate as Date, pending: Number(d.pending), date: d.date as Date }));
  const cli = pend("venta"), pro = pend("compra");
  const teDeben = cli.reduce((s, d) => s + d.pending, 0), debes = pro.reduce((s, d) => s + d.pending, 0);
  const late = (d: { due: Date }) => Math.round((t - d.due.getTime()) / DAY);
  const vencido = cli.filter((d) => late(d) > 0).reduce((s, d) => s + d.pending, 0);
  let wl = 0, ww = 0; for (const d of cli) if (late(d) > 0) { wl += late(d) * d.pending; ww += d.pending; }
  const byParty = (list: typeof cli) => {
    const m = new Map<string, { name: string; total: number; maxLate: number; docs: typeof cli }>();
    for (const d of list) { const r = m.get(d.partyId) ?? { name: d.partyName, total: 0, maxLate: -999, docs: [] }; r.total += d.pending; r.maxLate = Math.max(r.maxLate, late(d)); r.docs.push(d); m.set(d.partyId, r); }
    return [...m.values()];
  };
  const clients = byParty(cli);
  const topCli = [...clients].sort((a, b) => b.total - a.total)[0];
  const worst = [...clients].sort((a, b) => b.maxLate - a.maxLate).slice(0, 3);
  const cliRows = [topCli, ...worst.filter((w) => w !== topCli)].slice(0, 4);
  const lateTxt = (n: number) => (n > 1 ? `${n} días` : n === 1 ? "1 día" : "al día");
  const tone = (n: number): PvRow["tone"] => (n > 90 ? "b" : n > 30 ? "w" : undefined);
  const docRows = (r: (typeof clients)[number], max = 3) => r.docs.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, max).map((d) => [`${label(d)} · vence ${dm(d.due)}`, M(d.pending)]);

  const providers = byParty(pro);
  const in7 = pro.filter((d) => late(d) <= 0 && late(d) >= -7).reduce((s, d) => s + d.pending, 0);
  const proVencido = pro.filter((d) => late(d) > 0).reduce((s, d) => s + d.pending, 0);
  const whenTxt = (r: (typeof providers)[number]) => { const n = Math.min(...r.docs.map((d) => -late(d))); return n < 0 ? "vencida" : n === 0 ? "hoy" : n <= 7 ? `en ${n} días` : `en ${n} días`; };
  const proRows = [...providers].sort((a, b) => b.total - a.total).slice(0, 3);

  // ── Stock ──
  const prods = items.filter((i) => i.kind === "P").map((i) => ({ name: i.name, stock: Number(i.stock), min: Number(i.minimum ?? 0), cost: Number(i.cost), price: Number(i.price) }));
  const stockVal = prods.reduce((s, i) => s + Math.max(0, i.stock) * i.cost, 0);
  const bajo = prods.filter((i) => i.stock > 0 && i.stock < i.min), sin = prods.filter((i) => i.stock <= 0);
  const margenStock = prods.reduce((s, i) => s + (i.price - i.cost) / i.price, 0) / prods.length;

  // ── Ciclo de la plata (de la configuración de clientes y proveedores) ──
  const wsum = CLIENTS.reduce((s, c) => s + c.w, 0);
  const dso = Math.round(CLIENTS.reduce((s, c) => s + c.w * (30 + c.delay), 0) / wsum);
  const dpo = Math.round(SUPPLIERS.reduce((s, x) => s + (x.share ?? 0.02) * (x.term + x.delay + 2), 0) / SUPPLIERS.reduce((s, x) => s + (x.share ?? 0.02), 0));

  // ── IVA del mes en curso ──
  let ivaD = 0, ivaC = 0;
  for (const e of E) if (ym(e.date) === C) { if (e.account === "213100" && e.dc === "C") ivaD += e.amount; if (e.account === "114100" && e.dc === "D") ivaC += e.amount; }

  // ── Facturación del mes en curso ──
  const facMes = docs.filter((d) => d.kind === "venta" && ym(d.date as Date) === C);
  const facTot = facMes.reduce((s, d) => s + Number(d.total), 0);
  const facBy = new Map<string, { n: number; t: number }>();
  for (const d of facMes) { const r = facBy.get(d.partyName) ?? { n: 0, t: 0 }; r.n++; r.t += Number(d.total); facBy.set(d.partyName, r); }
  const facTop = [...facBy].sort((a, b) => b[1].t - a[1].t).slice(0, 3);

  // ── Punto de equilibrio ──
  const margenContrib = (now.ingresos - now.cmv - (-(now.a.get("511200") ?? 0)) - (-(now.a.get("511300") ?? 0))) / now.ingresos;
  const fijos = now.operativos - (-(now.a.get("511200") ?? 0)) - (-(now.a.get("511300") ?? 0)) + now.estructura + now.impuestos + now.financieros;
  const equilibrio = fijos / margenContrib;

  const monthName = MONTHS[last.getUTCMonth()], prevMonthName = MONTHS[prev.getUTCMonth()];
  const margen = (now.ingresos - now.cmv) / now.ingresos, margenPrev = (before.ingresos - before.cmv) / before.ingresos;
  const proj30 = caja + cli.filter((d) => late(d) >= -30 && late(d) <= 0).reduce((s, d) => s + d.pending, 0) * 0.85
    - pro.filter((d) => late(d) >= -30).reduce((s, d) => s + d.pending, 0) - (now.operativos + now.estructura) * 0.6;
  const cajaRows = cashCodes.map((c) => ({ c, name: accName.get(c)!, v: bal(c) })).sort((a, b) => b.v - a.v);
  const lastMoves = (code: string) => E.filter((e) => e.account === code && e.date.getTime() <= t).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 3).map((e) => {
    const d = e.srcId ? docs.find((x) => x.colppyId === e.srcId) : null;
    const what = e.srcTable === "COB" ? `Cobro · ${d?.partyName ?? "clientes"}` : e.srcTable === "OP" ? `Pago · ${d?.partyName ?? "proveedores"}` : (() => { const other = E.find((o) => o.colppyId !== e.colppyId && o.date.getTime() === e.date.getTime() && o.amount === e.amount && o.dc !== e.dc); return other ? accName.get(other.account) ?? "Movimiento" : "Saldo inicial"; })();
    return [`${dm(e.date)} · ${what}`, (e.dc === "D" ? "+" : "−") + M(e.amount)];
  });

  // ── Cartera: el mismo cálculo que la pantalla "Cartera y churn" ──
  const an = customerAnalytics(docs.map((d) => ({ kind: d.kind, partyId: d.partyId, partyName: d.partyName, docType: d.docType, date: d.date as Date, dueDate: (d.dueDate as Date | null) ?? null, total: Number(d.total), pending: Number(d.pending), paidAt: (d.paidAt as Date | null | undefined) ?? null })), today, 90);
  const ak = an.kpis;
  const dmyS = (iso: string) => iso.split("-").reverse().join("/");
  const objV = before.ingresos * 1.04, objE = objV * 0.12, objO = before.operativos * 1.03; // presupuesto de ejemplo
  const sections: Record<string, PvSection> = {
    pyl: {
      kpis: [[`Ventas · ${monthName}`, $M(now.ingresos), `${arrow(up(now.ingresos, before.ingresos))} vs. ${prevMonthName.slice(0, 3)}.`, up(now.ingresos, before.ingresos) >= 0 ? "g" : "b"],
        ["Margen bruto", pct(margen), Math.abs(margen - margenPrev) < 0.005 ? `igual que ${prevMonthName.slice(0, 3)}.` : `${margen > margenPrev ? "▲" : "▼"} vs. ${prevMonthName.slice(0, 3)}.`, "w"],
        ["EBITDA", $M(now.ebitda), `${pct(now.ebitda / now.ingresos, 1)} de ventas`, now.ebitda >= 0 ? "g" : "b"],
        ["Resultado", $M(now.resultado), arrow(up(now.resultado, before.resultado)), now.resultado >= before.resultado ? "g" : "b"]],
      cols: ["Línea", monthName[0].toUpperCase() + monthName.slice(1), "% ventas"],
      rows: [
        { c: ["Ventas", M(now.ingresos), "100%"], detail: accRows(["411100", "411200"]).map(([n, v]) => [n, v.replace("−", "")]) },
        { c: ["Costo de mercadería", signed(-now.cmv), pct(now.cmv / now.ingresos)], detail: cmvDetail },
        { c: ["Gastos operativos", signed(-now.operativos), pct(now.operativos / now.ingresos)], detail: accRows(["521100", "511200", "511300", "521300", "521200"]) },
        { c: ["Estructura", signed(-now.estructura), pct(now.estructura / now.ingresos)], detail: accRows(["531100", "531300", "531200", "531400"]) },
        { c: ["EBITDA", M(now.ebitda), pct(now.ebitda / now.ingresos, 1)], tone: "g" },
        { c: ["Impuestos", signed(-now.impuestos), pct(now.impuestos / now.ingresos, 1)], detail: accRows(["541100", "541200"]) },
        { c: ["Financieros", signed(-now.financieros), pct(now.financieros / now.ingresos, 1)], detail: accRows(["551200", "551100"]) },
        { c: ["Resultado", M(now.resultado), pct(now.resultado / now.ingresos, 1)], tone: now.resultado >= 0 ? "g" : "b" },
      ],
    },
    caja: {
      kpis: [["Caja hoy", $M(caja), `${(caja / gastoMes).toLocaleString("es-AR", { maximumFractionDigits: 1 })} meses de gastos`, "g"], ["Entró esta semana", $M(entro)], ["Salió esta semana", $M(salio)], ["En 30 días", $M(proj30), proj30 < caja ? "baja por pagos y sueldos" : "sube", proj30 < caja ? "w" : "g"]],
      cols: ["Cuenta", "Saldo hoy"],
      rows: cajaRows.map((r) => ({ c: [r.name, M(r.v)], detail: lastMoves(r.c) })),
    },
    cli: {
      kpis: [["Te deben", $M(teDeben)], ["Vencido", $M(vencido), `${pct(vencido / teDeben)} del total`, "b"], ["Atraso promedio", `${ww ? Math.round(wl / ww) : 0} días`, "", "w"], ["Clientes con deuda", String(clients.length)]],
      cols: ["Cliente", "Saldo", "Atraso"],
      rows: cliRows.map((r) => ({ c: [r.name, M(r.total), lateTxt(r.maxLate)], tone: tone(r.maxLate), detail: docRows(r) })),
    },
    prov: {
      kpis: [["Debés", $M(debes)], ["Vence esta semana", $M(in7), "", "w"], ["Vencido", $M(proVencido), "", proVencido > 0 ? "b" : "g"], ["Proveedores", String(providers.length)]],
      cols: ["Proveedor", "Saldo", "Vence"],
      rows: proRows.map((r) => ({ c: [r.name, M(r.total), whenTxt(r)], tone: whenTxt(r) === "vencida" ? "b" : undefined, detail: r.docs.slice(0, 3).map((d) => [`${label(d)} · vence ${dm(d.due)}`, M(d.pending)]) })),
    },
    stock: {
      kpis: [["Stock valorizado", $M(stockVal), "a costo"], ["Bajo mínimo", `${bajo.length} productos`, "", "w"], ["Sin stock", `${sin.length} productos`, "", "b"], ["Margen promedio", pct(margenStock), "", "g"]],
      cols: ["Producto", "Stock", "Mínimo"],
      rows: [...sin, ...bajo].slice(0, 5).map((i) => ({ c: [i.name, String(i.stock), String(i.min)], tone: i.stock <= 0 ? "b" : "w" })),
    },
    cap: {
      kpis: [["Capital de trabajo", $M(teDeben - debes)], ["Te deben", $M(teDeben)], ["Debés", `− ${$M(debes)}`]],
      cols: ["Componente", "Hoy"],
      rows: [
        { c: ["Te deben clientes", M(teDeben)], detail: [["Por vencer", M(teDeben - vencido)], ["Vencido", M(vencido)]] },
        { c: ["Debés a proveedores", signed(-debes)], detail: [["Vence en 30 días", signed(-pro.filter((d) => late(d) >= -30).reduce((s, d) => s + d.pending, 0))], ["Más adelante", signed(-pro.filter((d) => late(d) < -30).reduce((s, d) => s + d.pending, 0))]] },
        { c: ["Capital de trabajo", M(teDeben - debes)], tone: "w" },
      ],
      tip: `Si cobrás lo vencido, liberás ${$M(vencido)}.`,
    },
    ciclo: {
      kpis: [["Cobrás a", `${ak.realDays ?? dso} días`, `pactado ${ak.agreedDays ?? 30}`, "w"], ["Pagás a", `${dpo} días`], ["Ciclo", `${(ak.realDays ?? dso) - dpo} días`, (ak.realDays ?? dso) > dpo ? "lo financiás vos" : "te financian", (ak.realDays ?? dso) > dpo ? "w" : "g"]],
      cols: ["Cliente", "Pactado", "Real"],
      rows: [...CLIENTS].sort((a, b) => a.delay - b.delay).filter((_, i, a) => i === 0 || i === Math.floor(a.length / 2) || i === a.length - 1)
        .map((c) => ({ c: [c.name, "30 días", `${30 + c.delay} días`], tone: c.delay > 60 ? "b" : c.delay > 10 ? "w" : "g" })),
    },
    iva: {
      kpis: [["IVA débito", $M(ivaD)], ["IVA crédito", `− ${$M(ivaC)}`], [ivaD >= ivaC ? "A pagar" : "Saldo a favor", $M(Math.abs(ivaD - ivaC)), "vence el 18 del mes que viene", "w"]],
      cols: ["Concepto", MONTHS[today.getUTCMonth()][0].toUpperCase() + MONTHS[today.getUTCMonth()].slice(1)],
      rows: [{ c: ["Débito por ventas", M(ivaD)] }, { c: ["Crédito por compras", signed(-ivaC)] }, { c: ["Saldo", M(ivaD - ivaC)], tone: "w" }],
    },
    fac: {
      kpis: [["Facturado este mes", $M(facTot), `${facMes.length} facturas`, "g"], ["Ticket promedio", $M(facMes.length ? facTot / facMes.length : 0)]],
      cols: ["Cliente", "Facturado", "Facturas"],
      rows: facTop.map(([n, r]) => ({ c: [n, M(r.t), String(r.n)] })),
    },
    eq: {
      kpis: [["Punto de equilibrio", $Mr(equilibrio)], [`Ventas de ${monthName}`, $Mr(now.ingresos)], ["Margen de seguridad", pct(1 - equilibrio / now.ingresos), "", now.ingresos > equilibrio ? "g" : "b"]],
      cols: ["Cálculo", monthName[0].toUpperCase() + monthName.slice(1)],
      rows: [{ c: ["Costos fijos del mes", M(fijos)] }, { c: ["Margen de contribución", pct(margenContrib)] }, { c: ["Equilibrio = fijos ÷ margen", M(equilibrio)], tone: "w" }],
    },
    soc: {
      kpis: [["Cobrado en la semana", $M(entro)], ["Pagado en la semana", $M(salio)], ["Caja hoy", $M(caja)], ["Vencido de clientes", $M(vencido), "", "b"]],
      cols: ["Top deudores", "Saldo", "Atraso"],
      rows: [...clients].sort((a, b) => b.total - a.total).slice(0, 3).map((r) => ({ c: [r.name, M(r.total), lateTxt(r.maxLate)], tone: tone(r.maxLate) })),
    },
    ret: {
      kpis: [["Clientes activos", String(ak.active), `${ak.activeBefore} hace 90 días`, ak.active >= ak.activeBefore ? "g" : "w"], ["Nuevos · 90 días", String(ak.new90), $M(ak.newRevenue90) + " facturados", "g"],
        ["Perdidos · 90 días", String(ak.lost90), `churn ${pct(ak.churn)}`, ak.lost90 ? "b" : "g"], ["Recompra", pct(ak.repeat), "compraron en 2 meses o más", "g"]],
      cols: ["Cliente", "Venta 12 meses", "Días sin comprar"],
      rows: [...an.atRisk.slice(0, 2).map((r) => ({ c: [`${r.name} · en riesgo`, M(r.revenue12), String(r.daysSince)], tone: "w" as const, detail: [["Última compra", dmyS(r.last)], ["Compraba cada", r.interval ? `${r.interval} días` : "—"]] })),
        ...an.lost.slice(0, 3).map((r) => ({ c: [`${r.name} · perdido`, M(r.revenue12), String(r.daysSince)], tone: "b" as const, detail: [["Última compra", dmyS(r.last)], ["Compraba cada", r.interval ? `${r.interval} días` : "—"]] }))],
      tip: `Concentración: tus 5 clientes más grandes son el ${pct(ak.top5Share)} de la venta. Días reales de cobro: ${ak.realDays} (pactado ${ak.agreedDays}).`,
    },
    ppto: {
      kpis: [["Ventas vs. objetivo", pct(now.ingresos / (objV)), "", "w"], ["EBITDA vs. objetivo", pct(now.ebitda / (objE)), "", now.ebitda >= objE ? "g" : "w"]],
      cols: ["Línea", "Objetivo", "Real", "Desvío"],
      rows: [
        { c: ["Ventas", M(objV), M(now.ingresos), pct(now.ingresos / (objV) - 1)], tone: now.ingresos >= objV ? "g" : "w" },
        { c: ["Gastos operativos", signed(-objO), signed(-now.operativos), pct(now.operativos / (objO) - 1)], tone: "w" },
        { c: ["EBITDA", M(objE), M(now.ebitda), pct(now.ebitda / (objE) - 1)], tone: now.ebitda >= objE ? "g" : "w" },
      ],
      tip: "En el ejemplo, el objetivo es el mes anterior + 4% en ventas. Vos lo cargás desde Excel o con el año anterior + un %.",
    },
  };

  const worstCli = worst[0];
  return {
    company: "Distribuidora del Sol", monthName, prevMonthName,
    tiles: {
      dash: [["Ventas del mes", $Mr(now.ingresos), arrow(up(now.ingresos, before.ingresos)), "g"], ["Ganancia", $Mr(now.resultado), `${pct(now.resultado / now.ingresos)} margen`, "g"], ["Caja hoy", $Mr(caja), `${(caja / gastoMes).toLocaleString("es-AR", { maximumFractionDigits: 1 })} meses`, "w"], ["Te deben", $Mr(teDeben), `${pct(vencido / teDeben)} vencido`, "b"]],
    },
    extra: {
      pylMini: [["Ventas", M(now.ingresos)], ["Costos", signed(-(now.cmv + now.operativos))], ["Estructura", signed(-now.estructura)], ["EBITDA", M(now.ebitda)], ["Resultado neto", M(now.resultado)]],
      worst: worst.slice(0, 2).map((w) => [w.name, `${w.maxLate} días`]),
      aging: [[-9999, 0], [0, 30], [30, 60], [60, 90], [90, 99999]].map(([lo, hi]) => cli.filter((d) => late(d) > lo && late(d) <= hi).reduce((s, d) => s + d.pending, 0)),
      prov4: [0, 1, 2, 3].map((w) => pro.filter((d) => { const n = -late(d); return n >= w * 7 && n < (w + 1) * 7; }).reduce((s, d) => s + d.pending, 0)),
      fac: [$Mr(facTot), `${facMes.length} facturas`], iva: [$M(Math.abs(ivaD - ivaC)), "vence el 18"], stock: [$Mr(stockVal), `${bajo.length + sin.length} productos para reponer`],
      ret: [String(ak.active), `${ak.lost90} perdidos y ${ak.new90} nuevos en 90 días`],
      ppto: pct(now.ingresos / (objV)), cap: [$M(teDeben - debes), M(teDeben), M(debes)], ciclo: [`${dso - dpo} días`, `cobrás a ${dso} · pagás a ${dpo}`],
      eq: [$Mr(equilibrio), `${monthName} lo superó ${pct(now.ingresos / equilibrio - 1)}`],
      ia: [`¿Qué cliente me conviene menos?`, `${worstCli.name}: te debe ${$M(worstCli.total)} y paga a ${worstCli.maxLate} días del vencimiento.`],
    },
    sections,
  };
}
