"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement, BarController, LineController } from "chart.js";
import { Chart } from "react-chartjs-2";
import type { DashboardData } from "@/lib/dashboard";
import { CATEGORIES, type Category } from "@/lib/categories";
import { STAGES, STAGE_LABELS } from "@/lib/progress";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement, BarController, LineController);

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mLabel = (ym: string) => `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
const fmt = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `$ ${(n / 1e9).toFixed(1)} mil M`;
  if (a >= 1e6) return `$ ${(n / 1e6).toFixed(1)} M`;
  return fmt(n);
};
const pct = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : 0);
const gastosDe = (m: DashboardData["months"][number]) => m.costos + m.estructura + m.impuestos + m.financieros + m.sinClasificar;

type Resp = { company: { id: string; name: string; lastSyncAt: string | null; status: string }; data: DashboardData };
type Run = { progress: string | null; percent?: number; ok: boolean | null; error: string | null; startedAt?: string } | null;

export default function Dashboard({ companyId }: { companyId: string }) {
  const [resp, setResp] = useState<Resp | null>(null);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<Run>(null);
  const [debt, setDebt] = useState<{ cli?: { total: number; overdue: number; avgLate: number }; prov?: { total: number; overdue: number; next7: number } }>({});

  const load = useCallback(async () => {
    const r = await fetch(`/api/dashboard?company=${companyId}`, { cache: "no-store" });
    if (r.ok) setResp(await r.json());
    // Resumen de deuda para las tiras de abajo (si todavía no hay facturas, no se muestran)
    const [c, p] = await Promise.all(["clientes", "proveedores"].map((k) => fetch(`/api/deuda?company=${companyId}&kind=${k}`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null)));
    setDebt({
      cli: c?.parties?.length ? { total: c.totals.total, overdue: c.totals.overdue, avgLate: c.totals.avgLate } : undefined,
      prov: p?.parties?.length ? { total: p.totals.total, overdue: p.totals.overdue, next7: p.totals.byBucket[1] } : undefined,
    });
  }, [companyId]);

  const poll = useCallback(async () => {
    const r = await fetch(`/api/sync?company=${companyId}`, { cache: "no-store" });
    if (!r.ok) return false;
    const j = await r.json();
    setRun(j.run); setRunning(j.running);
    return j.running as boolean;
  }, [companyId]);

  useEffect(() => {
    load();
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => { if (await poll()) t = setTimeout(tick, 3000); else load(); };
    tick();
    return () => clearTimeout(t);
  }, [load, poll]);

  const [syncError, setSyncError] = useState<string | null>(null);
  async function syncNow() {
    setRunning(true); setSyncError(null);
    const r = await fetch(`/api/sync?company=${companyId}`, { method: "POST" });
    if (!r.ok) {
      // Antes este error se perdía y parecía que el botón no hacía nada
      const j = await r.json().catch(() => ({}));
      setSyncError(j.error ?? `El servidor respondió con error ${r.status}`);
      setRunning(false);
      return;
    }
    const tick = async () => { if (await poll()) setTimeout(tick, 3000); else load(); };
    tick();
  }

  if (!resp) return <p className="muted">Cargando…</p>;
  const { company, data } = resp;
  const months = data.months;
  // El mes en curso está a medio cargar: los indicadores comparan el último mes CERRADO contra el anterior
  const cur = months[months.length - 2];
  const prev = months[months.length - 3];
  const margen = cur.ingresos ? (cur.ebitda / cur.ingresos) * 100 : 0;
  const q = `?company=${companyId}`;

  return (
    <>
      <div className="head">
        <div>
          <div className="crumb">Inicio</div>
          <h1>{company.name}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {data.lastEntry ? `Contabilidad al ${data.lastEntry.split("-").reverse().join("/")}` : "Todavía sin datos"}
            {company.lastSyncAt && ` · actualizado ${new Date(company.lastSyncAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`}
            {data.futureEntries > 0 && ` · ${data.futureEntries} asientos con fecha futura`}
          </p>
        </div>
        <button className="btn ghost" onClick={syncNow} disabled={running}>{running ? "Actualizando…" : "↻ Actualizar ahora"}</button>
      </div>

      {running && <SyncProgress run={run} />}
      {syncError && <div className="error" style={{ marginBottom: 14 }}>No se pudo actualizar: {syncError}</div>}
      {!running && !syncError && run?.ok === false && <div className="error" style={{ marginBottom: 14 }}>No se pudo actualizar: {run.error}</div>}

      {(data.unclassified.length > 0 || data.toReview > 0) && data.hasData && (
        <Link href={`/app/cuentas${q}`} className="notice">
          <span>
            {data.unclassified.length > 0
              ? <><strong>{data.unclassified.length} cuentas con movimiento sin categoría</strong> (entre ellas {data.unclassified.slice(0, 2).map((u) => u.name).join(", ")}). Se suman como gasto hasta que las clasifiques.</>
              : <><strong>{data.toReview} cuentas clasificadas automáticamente</strong> esperan tu confirmación.</>}
          </span>
          <span className="up">Revisar →</span>
        </Link>
      )}

      {!data.hasData ? (
        <div className="card empty">
          <h2>{running ? "Estamos trayendo tu contabilidad" : "Todavía no hay movimientos"}</h2>
          <p>{running ? "Apenas termine, acá vas a ver tus ingresos, EBITDA, resultado y caja de los últimos 12 meses." : "Tocá “Actualizar ahora” para traer la contabilidad de Colppy."}</p>
        </div>
      ) : (
        <>
          <div className="grid kpis">
            <Kpi label={`Ingresos · ${mLabel(cur.month)}`} value={cur.ingresos} prev={prev.ingresos} />
            <Kpi label={`EBITDA · ${mLabel(cur.month)}`} value={cur.ebitda} prev={prev.ebitda} sub={`Margen ${margen.toFixed(1)}%`} />
            <Kpi label={`Resultado · ${mLabel(cur.month)}`} value={cur.resultado} prev={prev.resultado} />
            <Kpi label={`Caja neta · ${mLabel(cur.month)}`} value={cur.cajaNeta} prev={prev.cajaNeta} sub="Lo que entró menos lo que salió" />
          </div>

          <div className="grid two">
            <div className="card">
              <h3>Ingresos, gastos y resultado — últimos 12 meses</h3>
              <Chart
                type="bar"
                data={{
                  labels: months.map((m) => mLabel(m.month) + (m.partial ? " (en curso)" : "")),
                  datasets: [
                    { type: "bar" as const, label: "Ingresos", data: months.map((m) => m.ingresos), backgroundColor: months.map((m) => (m.partial ? "rgba(62,207,142,.25)" : "#3ecf8e")), borderRadius: 4 },
                    { type: "bar" as const, label: "Gastos", data: months.map(gastosDe), backgroundColor: months.map((m) => (m.partial ? "rgba(240,96,96,.25)" : "#f06060")), borderRadius: 4 },
                    // El mes en curso no se dibuja en la línea: el resultado parcial engaña
                    { type: "line" as const, label: "Resultado", data: months.map((m) => (m.partial ? null : m.resultado)), borderColor: "#5b9cf6", backgroundColor: "#5b9cf6", tension: 0.3, spanGaps: false },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { labels: { color: "#b0b0c0", boxWidth: 10 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(Number(c.raw))}` } } },
                  scales: {
                    x: { ticks: { color: "#8888a0", callback: (_v, i) => mLabel(months[i].month) }, grid: { display: false } },
                    y: { ticks: { color: "#8888a0", callback: (v) => short(Number(v)) }, grid: { color: "#252529" } },
                  },
                }}
              />
            </div>
            <div className="card">
              <h3>Principales gastos de {mLabel(cur.month)}</h3>
              {data.topGastos.length === 0 && <p className="muted small">Sin gastos registrados.</p>}
              {data.topGastos.map((g) => (
                <div className="row" key={g.code}>
                  <span>{g.name}<span className="muted small"> · {CATEGORIES[g.category as Category]?.label ?? ""}</span></span>
                  <span className="mono">{short(g.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {(debt.cli || debt.prov) && (
            <div className="debt-strip">
              {debt.cli && (
                <Link href={`/app/clientes${q}`} className="card">
                  <span><div className="kpi-label">Te deben</div><div className="kpi-value">{short(debt.cli.total)}</div><div className="kpi-sub down">{short(debt.cli.overdue)} vencido · atraso prom. {debt.cli.avgLate} días</div></span>
                  <span className="up small">Ver y reclamar →</span>
                </Link>
              )}
              {debt.prov && (
                <Link href={`/app/proveedores${q}`} className="card">
                  <span><div className="kpi-label">Debés a proveedores</div><div className="kpi-value">{short(debt.prov.total)}</div><div className="kpi-sub muted">{short(debt.prov.overdue)} vencido · {short(debt.prov.next7)} vence en 7 días</div></span>
                  <span className="up small">Ver y pagar →</span>
                </Link>
              )}
            </div>
          )}

          <div className="card" style={{ marginTop: 14 }}>
            <h3>Cómo se llega al resultado · {mLabel(cur.month)}</h3>
            <div className="waterfall">
              <Step label="Ingresos" v={cur.ingresos} />
              <Step label="Costos operativos" v={-cur.costos} />
              <Step label="Contribución" v={cur.contribucion} total />
              <Step label="Estructura" v={-cur.estructura} />
              <Step label="EBITDA" v={cur.ebitda} total />
              <Step label="Impuestos" v={-cur.impuestos} />
              <Step label="Financieros" v={-cur.financieros} />
              {cur.sinClasificar !== 0 && <Step label="Sin clasificar" v={-cur.sinClasificar} />}
              <Step label="Resultado" v={cur.resultado} total />
            </div>
            {(cur.inversiones !== 0 || cur.circuitoIva !== 0) && (
              <p className="muted small" style={{ marginTop: 12 }}>
                Aparte del resultado:{cur.inversiones !== 0 && ` inversiones ${short(cur.inversiones)}`}{cur.inversiones !== 0 && cur.circuitoIva !== 0 && " ·"}{cur.circuitoIva !== 0 && ` circuito financiero (IVA) neto ${short(cur.circuitoIva)}`}.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, prev, invert, sub }: { label: string; value: number; prev: number; invert?: boolean; sub?: string }) {
  const d = pct(value, prev);
  const good = invert ? d <= 0 : d >= 0;
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${value < 0 ? "down" : ""}`}>{short(value)}</div>
      {prev !== 0 && <div className={`kpi-sub ${good ? "up" : "down"}`}>{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}% vs. mes anterior</div>}
      {sub && <div className="kpi-sub muted">{sub}</div>}
    </div>
  );
}

function Step({ label, v, total }: { label: string; v: number; total?: boolean }) {
  return (
    <div className={`wf-row ${total ? "total" : ""}`}>
      <span>{label}</span>
      <span className={`mono ${v < 0 ? "down" : total ? "" : "up"}`}>{short(v)}</span>
    </div>
  );
}

/** Barra de avance de la sincronización: porcentaje, etapa actual, pasos tildados y tiempo estimado. */
function SyncProgress({ run }: { run: Run }) {
  const pct = Math.max(2, run?.percent ?? 0);
  let eta: string | null = null;
  if (run?.startedAt && pct >= 8 && pct < 100) {
    const elapsed = (Date.now() - new Date(run.startedAt).getTime()) / 1000;
    const left = Math.round((elapsed / pct) * (100 - pct));
    eta = left < 60 ? "menos de un minuto" : `~${Math.round(left / 60)} min`;
  }
  return (
    <div className="card sync-card">
      <div className="sync-top">
        <strong>{run?.progress ?? "Conectando con Colppy…"}</strong>
        <span className="mono">{pct}%{eta ? <span className="muted"> · faltan {eta}</span> : null}</span>
      </div>
      <div className="sync-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="sync-steps">
        {STAGE_LABELS.map(([k, l]) => {
          const [a, b] = STAGES[k];
          const st = pct >= b ? "done" : pct >= a ? "now" : "";
          return <span key={k} className={st}>{st === "done" ? "✓" : st === "now" ? "●" : "○"} {l}</span>;
        })}
      </div>
    </div>
  );
}
