// ─── Dólar e inflación: la "moneda" de cada número ───────────────────────────
// Colppy registra en pesos nominales. Para que el dueño no se engañe con la inflación, Numo puede mostrar
// cada número de tres maneras:
//   · $ nominal  — tal cual está en la contabilidad
//   · $ de hoy   — ajustado por inflación (IPC del INDEC) a pesos del último mes publicado
//   · US$        — cada movimiento dividido por la cotización del dólar DEL DÍA en que pasó
// Las cotizaciones y el IPC vienen de ArgentinaDatos (api.argentinadatos.com, sin clave) y se guardan en la
// base; se refrescan como mucho cada 6 horas y en la actualización automática de cada noche.
import { db } from "./db";

const BASE = "https://api.argentinadatos.com/v1";
export const FX_CASAS = {
  oficial: { label: "Oficial BNA", long: "dólar oficial del Banco Nación, vendedor" },
  bolsa: { label: "MEP", long: "dólar MEP, vendedor" },
  mayorista: { label: "Mayorista", long: "dólar mayorista (A3500)" },
} as const;
export type Casa = keyof typeof FX_CASAS;
export type View = "nominal" | "real" | "usd";
export const isCasa = (x: unknown): x is Casa => typeof x === "string" && x in FX_CASAS;

const FROM = "2018-01-01"; // historia que guardamos
const parseDay = (s: unknown) => { const m = String(s ?? "").match(/^(\d{4})[-/](\d{2})[-/](\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

async function getJson(url: string) {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json() as Promise<unknown>;
}

/** Trae cotizaciones e inflación y las guarda. Lo nuevo se agrega; los últimos días se reescriben (por si corrigen). */
export async function refreshMacro() {
  const out: Record<string, number> = {};
  for (const casa of Object.keys(FX_CASAS) as Casa[]) {
    try {
      const list = (await getJson(`${BASE}/cotizaciones/dolares/${casa}`)) as { fecha?: string; compra?: number; venta?: number }[];
      const rows = (Array.isArray(list) ? list : []).map((x) => ({ day: parseDay(x.fecha), buy: num(x.compra), sell: num(x.venta) }))
        .filter((x): x is { day: string; buy: number | null; sell: number } => !!x.day && x.day >= FROM && x.sell !== null);
      if (!rows.length) continue;
      await db.fxRate.createMany({ data: rows.map((x) => ({ casa, date: new Date(x.day), buy: x.buy, sell: x.sell })), skipDuplicates: true });
      const recent = rows.sort((a, b) => a.day.localeCompare(b.day)).slice(-10);
      await db.$transaction(recent.map((x) => db.fxRate.upsert({ where: { casa_date: { casa, date: new Date(x.day) } }, create: { casa, date: new Date(x.day), buy: x.buy, sell: x.sell }, update: { buy: x.buy, sell: x.sell } })));
      out[casa] = rows.length;
    } catch (e) { console.error("[macro] dólar", casa, e); }
  }
  try {
    const list = (await getJson(`${BASE}/finanzas/indices/inflacion`)) as { fecha?: string; valor?: number }[];
    const rows = (Array.isArray(list) ? list : []).map((x) => ({ month: parseDay(x.fecha)?.slice(0, 7), pct: Number(x.valor) }))
      .filter((x): x is { month: string; pct: number } => !!x.month && x.month >= "2017-01" && Number.isFinite(x.pct));
    if (rows.length) {
      await db.$transaction(rows.map((x) => db.cpiMonth.upsert({ where: { month: x.month }, create: x, update: { pct: x.pct } })));
      out.ipc = rows.length;
    }
  } catch (e) { console.error("[macro] inflación", e); }
  return out;
}

let lastTry = 0;
let inflight: Promise<unknown> | null = null;
/** Refresca en segundo plano si pasaron más de 6 horas. Si la base está vacía, espera (hasta 15 s) para no mostrar un tablero sin datos. */
export async function ensureMacro() {
  if (Date.now() - lastTry > 6 * 3_600_000 && !inflight) {
    lastTry = Date.now();
    inflight = refreshMacro().finally(() => { inflight = null; });
  }
  if (inflight && (await db.fxRate.count({ take: 1 })) === 0) await Promise.race([inflight, new Promise((r) => setTimeout(r, 15_000))]);
}

export type Converter = {
  view: View; casa: Casa; available: boolean;
  /** Factor para multiplicar un importe en pesos de ese día ("YYYY-MM-DD"). */
  factor: (day: string) => number;
  /** Factor para un saldo de hoy (deudas, caja). */
  today: number;
  note: string; symbol: string;
};

const dmy = (d: string) => d.split("-").reverse().join("/");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmtRate = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export async function converter(view: View, casa: Casa = "oficial", from = new Date("2018-01-01")): Promise<Converter> {
  const nominal: Converter = { view: "nominal", casa, available: true, factor: () => 1, today: 1, note: "En pesos tal cual figuran en la contabilidad.", symbol: "$" };
  if (view === "nominal") return nominal;
  await ensureMacro().catch(() => null);

  if (view === "usd") {
    const rates = await db.fxRate.findMany({ where: { casa, date: { gte: new Date(from.getTime() - 15 * 86_400_000) } }, orderBy: { date: "asc" }, select: { date: true, sell: true } });
    if (!rates.length) return { ...nominal, view, available: false, note: "Todavía no tenemos las cotizaciones del dólar: se muestran pesos. Probá en unos minutos." };
    const days = rates.map((r) => r.date.toISOString().slice(0, 10)), vals = rates.map((r) => Number(r.sell));
    // la cotización del día, o la del último día hábil anterior (fines de semana y feriados)
    const at = (day: string) => {
      let lo = 0, hi = days.length - 1, ans = 0;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (days[mid] <= day) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      return vals[ans];
    };
    const lastDay = days[days.length - 1], last = vals[vals.length - 1];
    return {
      view, casa, available: true, symbol: "US$",
      factor: (day) => 1 / at(day), today: 1 / last,
      note: `En dólares: cada movimiento al ${FX_CASAS[casa].long} del día en que pasó. Último dato: ${dmy(lastDay)}, $ ${fmtRate(last)}.`,
    };
  }

  // Pesos de hoy: índice acumulado con el IPC mensual; los meses posteriores al último publicado quedan como están
  const cpi = await db.cpiMonth.findMany({ orderBy: { month: "asc" } });
  if (!cpi.length) return { ...nominal, view, available: false, note: "Todavía no tenemos la inflación del INDEC: se muestran pesos nominales. Probá en unos minutos." };
  const idx = new Map<string, number>();
  let acc = 1;
  for (const c of cpi) { acc *= 1 + Number(c.pct) / 100; idx.set(c.month, acc); }
  const lastMonth = cpi[cpi.length - 1].month, top = idx.get(lastMonth)!;
  const firstMonth = cpi[0].month;
  return {
    view, casa, available: true, symbol: "$", today: 1,
    factor: (day) => { const m = day.slice(0, 7); if (m >= lastMonth) return 1; if (m < firstMonth) return top; return top / idx.get(m)!; },
    note: `En pesos de ${MESES[+lastMonth.slice(5, 7) - 1]} ${lastMonth.slice(0, 4)}: cada mes ajustado por la inflación del INDEC (último dato publicado).`,
  };
}
