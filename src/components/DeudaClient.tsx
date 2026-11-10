"use client";
// Deuda de clientes / con proveedores. Como el panel de Infocampo:
// tocar un tramo de antigüedad filtra el gráfico por mes y la lista; tocar un mes filtra la barra y la lista.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, BarController } from "chart.js";
import { Bar } from "react-chartjs-2";
import { Icon } from "@/components/Sidebar";
import PartyDrawer from "@/components/PartyDrawer";
import type { Cell, PartyRow, Kind } from "@/lib/deuda";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, BarController);

type Resp = {
  company: { id: string; name: string; lastSyncAt: string | null };
  asOf: string; buckets: string[]; months: string[];
  totals: { total: number; overdue: number; credit: number; avgLate: number; parties: number; noEmail: number; byBucket: number[] };
  parties: PartyRow[];
};

// Por vencer en verde; lo vencido en una escala de rojo que se oscurece con los días (la de Infocampo)
const COLORS: Record<Kind, string[]> = {
  clientes: ["#2F7D4F", "#EE9F86", "#E0704F", "#C84A30", "#9E2D1D", "#691A10"],
  proveedores: ["#C84A30", "#E0A040", "#5b9cf6", "#2F7D4F"],
};
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mLabel = (m: string) => `${MES[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`;
const short = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$ ${(v / 1e6).toFixed(1)} M` : a >= 1e3 ? `$ ${Math.round(v / 1e3)} k` : `$ ${Math.round(v)}`; };
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const ago = (iso: string) => { const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`; };

export default function DeudaClient({ kind }: { kind: Kind }) {
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(params.get("company"));
  const [d, setD] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bucket, setBucket] = useState<number | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const isCli = kind === "clientes";

  useEffect(() => {
    if (companyId) return;
    fetch("/api/conexiones/colppy").then((r) => r.json()).then((j) => setCompanyId(j.companies?.[0]?.id ?? ""));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/deuda?company=${companyId}&kind=${kind}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setError(j.error ?? "No se pudo cargar"); else setD(j);
  }, [companyId, kind]);
  useEffect(() => { load(); }, [load]);

  const view = useMemo(() => {
    if (!d) return null;
    const nb = d.buckets.length;
    const inMonth = (c: Cell) => !month || c[0] === month;
    const inBucket = (c: Cell) => bucket === null || c[1] === bucket;
    const byBucket = Array(nb).fill(0) as number[];
    const byMonth = new Map<string, number[]>(d.months.map((m) => [m, Array(nb).fill(0)]));
    const s = q.trim().toLowerCase();
    const rows = d.parties.map((p) => {
      const b = Array(nb).fill(0) as number[];
      for (const c of p.cells) {
        if (inMonth(c)) { byBucket[c[1]] += c[2]; if (inBucket(c)) b[c[1]] += c[2]; }
        if (inBucket(c)) byMonth.get(c[0])![c[1]] += c[2];
      }
      return { ...p, b, shown: sum(b) };
    }).filter((p) => (bucket === null && !month ? Math.abs(p.total) > 1 : p.shown > 1))
      .filter((p) => !s || p.name.toLowerCase().includes(s) || (p.alias ?? "").toLowerCase().includes(s))
      .sort((a, b) => b.shown - a.shown || b.total - a.total);
    const months = d.months.filter((m) => sum(byMonth.get(m)!) > 1);
    return { byBucket, byMonth, months, rows };
  }, [d, bucket, month, q]);

  if (error) return <div className="error">{error}</div>;
  if (!d || !view) return <p className="muted">Cargando…</p>;
  const colors = COLORS[kind];
  const totalBar = sum(view.byBucket) || 1;
  const t = d.totals;
  const next7 = isCli ? 0 : t.byBucket[1];

  return (
    <>
      <div className="head">
        <div>
          <div className="crumb"><Icon name={isCli ? "users" : "truck"} size={13} /> {isCli ? "Clientes" : "Proveedores"}</div>
          <h1>{isCli ? "Deuda de clientes" : "Deuda con proveedores"}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Saldos al {d.asOf.split("-").reverse().join("/")} · desde Colppy{d.company.lastSyncAt ? `, actualizado ${new Date(d.company.lastSyncAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : ""}</p>
        </div>
      </div>

      {d.parties.length === 0 ? (
        <div className="card empty">
          <h2>{isCli ? "Nadie te debe nada" : "No tenés deudas con proveedores"}</h2>
          <p>Si recién conectaste Colppy, tocá “Actualizar ahora” en el Tablero para traer las facturas.</p>
        </div>
      ) : (
        <>
          <div className="grid kpis">
            <div className="card"><div className="kpi-label">{isCli ? "Te deben" : "Debés"}</div><div className="kpi-value">{short(t.total)}</div><div className="kpi-sub muted">{t.parties} {isCli ? "clientes" : "proveedores"}</div></div>
            <div className="card"><div className="kpi-label">Vencido</div><div className="kpi-value down">{short(t.overdue)}</div><div className="kpi-sub muted">{t.total ? Math.round((t.overdue / t.total) * 100) : 0}% del total</div></div>
            {isCli
              ? <div className="card"><div className="kpi-label">+90 días</div><div className="kpi-value down">{short(t.byBucket[4] + t.byBucket[5])}</div><div className="kpi-sub muted">Atraso promedio {t.avgLate} días</div></div>
              : <div className="card"><div className="kpi-label">Vence en 7 días</div><div className="kpi-value">{short(next7)}</div><div className="kpi-sub muted">Para la orden de pago de la semana</div></div>}
            <div className="card"><div className="kpi-label">{isCli ? "Crédito a favor de clientes" : "Saldo a favor nuestro"}</div><div className="kpi-value">{short(Math.abs(t.credit))}</div><div className="kpi-sub muted">{t.noEmail ? `${t.noEmail} sin mail cargado` : "NC y pagos a cuenta"}</div></div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>{isCli ? "Antigüedad de la deuda" : "Cuándo hay que pagar"}{month ? ` · facturas de ${mLabel(month)}` : ""}</h3>
              {(bucket !== null || month) && <button className="btn ghost sm" onClick={() => { setBucket(null); setMonth(null); }}>Quitar filtros</button>}
            </div>
            <div className="aging">
              {view.byBucket.map((v, i) => v > 0 && (
                <button key={i} className={`aging-seg ${bucket === i ? "on" : ""} ${bucket !== null && bucket !== i ? "dim" : ""}`} style={{ flex: v / totalBar, background: colors[i] }} onClick={() => setBucket(bucket === i ? null : i)} title={`${d.buckets[i]}: ${short(v)}`} />
              ))}
            </div>
            <div className="aging-legend">
              {d.buckets.map((b, i) => (
                <button key={b} className={`legend-item ${bucket === i ? "on" : ""}`} onClick={() => setBucket(bucket === i ? null : i)}>
                  <i style={{ background: colors[i] }} /> {b} <span className="mono">{short(view.byBucket[i])}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="muted small" style={{ marginBottom: 6 }}>Saldo por mes de factura · tocá una barra para filtrar</div>
              <Bar
                height={70}
                data={{
                  labels: view.months.map(mLabel),
                  datasets: d.buckets.map((b, i) => ({ label: b, data: view.months.map((m) => view.byMonth.get(m)![i]), backgroundColor: view.months.map((m) => (month && m !== month ? colors[i] + "55" : colors[i])), stack: "s", borderRadius: 2 })),
                }}
                options={{
                  responsive: true,
                  onClick: (_e, els) => { const i = els[0]?.index; if (i !== undefined) setMonth(month === view.months[i] ? null : view.months[i]); },
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${short(Number(c.raw))}` } } },
                  scales: { x: { stacked: true, ticks: { color: "#8888a0" }, grid: { display: false } }, y: { stacked: true, ticks: { color: "#8888a0", callback: (v) => short(Number(v)) }, grid: { color: "#252529" } } },
                }}
              />
            </div>
          </div>

          <div className="card" style={{ padding: 0, marginTop: 14 }}>
            <div className="toolbar">
              <div className="small muted">{view.rows.length} {isCli ? "clientes" : "proveedores"}{bucket !== null ? ` · ${d.buckets[bucket]}` : ""}{month ? ` · ${mLabel(month)}` : ""}</div>
              <input placeholder={`Buscar ${isCli ? "cliente" : "proveedor"}…`} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
            </div>
            <div className="table-wrap">
              <table className="table clickable">
                <thead><tr>
                  <th>{isCli ? "Cliente" : "Proveedor"}</th><th className="num">{bucket !== null || month ? "Filtrado" : "Saldo"}</th><th className="num">Vencido</th>
                  <th style={{ width: 160 }}>Composición</th><th className="num">{isCli ? "Atraso máx." : "Próx. venc."}</th><th>Último mail</th><th></th>
                </tr></thead>
                <tbody>
                  {view.rows.map((p) => {
                    const tot = sum(p.b) || 1;
                    return (
                      <tr key={p.id} onClick={() => setOpen(p.id)}>
                        <td>
                          <div>{p.name}</div>
                          <div className="muted small">{p.alias && p.alias !== p.name ? `${p.alias} · ` : ""}{p.email ?? <span style={{ color: "var(--yellow)" }}>sin mail</span>}</div>
                        </td>
                        <td className="num mono">{short(bucket !== null || month ? p.shown : p.total)}</td>
                        <td className={`num mono ${p.overdue > 0 ? "down" : "muted"}`}>{p.overdue > 0 ? short(p.overdue) : "—"}</td>
                        <td><div className="mini-bar">{p.b.map((v, i) => v > 0 && <span key={i} style={{ flex: v / tot, background: colors[i] }} />)}</div></td>
                        <td className="num small">{isCli ? (p.maxLate > 0 ? <span className={p.maxLate > 90 ? "down" : ""}>{p.maxLate} días</span> : <span className="muted">al día</span>) : (p.maxLate > 0 ? <span className="down">vencido</span> : <span className="muted">en {-p.maxLate} días</span>)}</td>
                        <td className="small muted">{p.lastMail ? `${p.lastMail.kind === "orden_pago" ? "Orden de pago" : "Reclamo"} ${ago(p.lastMail.at)}` : "—"}</td>
                        <td className="num"><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setOpen(p.id); }}>{isCli ? "Reclamar" : "Gestionar"}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {open && companyId && <PartyDrawer companyId={companyId} companyName={d.company.name} kind={kind} partyId={open} onClose={() => setOpen(null)} onSent={load} />}
    </>
  );
}
