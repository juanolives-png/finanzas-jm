"use client";
// Clientes → Cartera: quién compra, quién dejó de comprar, quién está por irse y en cuántos días te pagan de verdad.
// Cada cliente se abre (la misma ficha de Deuda y reclamos), sin ir a Colppy.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement, BarController, LineController } from "chart.js";
import { Chart } from "react-chartjs-2";
import { Icon } from "@/components/Sidebar";
import PartyDrawer from "@/components/PartyDrawer";
import { cssVar, useThemeKey } from "@/lib/theme";
import type { CustomerAnalytics, ClientRow } from "@/lib/clientes";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement, BarController, LineController);

type Resp = CustomerAnalytics & { company: { id: string; name: string; source: string } };
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mLabel = (ym: string) => `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
const short = (v: number) => { const a = Math.abs(v); const d = (x: number) => x.toLocaleString("es-AR", { maximumFractionDigits: 1 }); return a >= 1e6 ? `$ ${d(v / 1e6)} M` : a >= 1e3 ? `$ ${Math.round(v / 1e3)} k` : `$ ${Math.round(v)}`; };
const pct = (x: number) => `${Math.round(x * 100)}%`;
const dmy = (s: string) => s.split("-").reverse().join("/");
const DIAS_KEY = "numo-lost-days";
type Tab = "riesgo" | "perdidos" | "cobro" | "todos";

export default function CarteraClient() {
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(params.get("company"));
  const [dias, setDias] = useState(90);
  const [d, setD] = useState<Resp | null>(null);
  const [tab, setTab] = useState<Tab>("riesgo");
  const [open, setOpen] = useState<string | null>(null);
  const themeKey = useThemeKey();

  useEffect(() => { try { const v = Number(localStorage.getItem(DIAS_KEY)); if (v) setDias(v); } catch { /* nada */ } }, []);
  useEffect(() => {
    if (companyId) return;
    fetch("/api/conexiones/colppy").then((r) => r.json()).then((j) => setCompanyId(j.companies?.find((c: { source: string }) => c.source !== "demo")?.id ?? j.companies?.[0]?.id ?? ""));
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/clientes/analisis?company=${companyId}&dias=${dias}`, { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, [companyId, dias]);
  useEffect(() => { load(); }, [load]);
  const pickDias = (v: number) => { setDias(v); try { localStorage.setItem(DIAS_KEY, String(v)); } catch { /* nada */ } };

  if (!d) return <p className="muted">Cargando…</p>;
  const k = d.kpis;
  const lists: Record<Tab, ClientRow[]> = {
    riesgo: d.atRisk, perdidos: d.lost,
    cobro: d.clients.filter((c) => c.realDays !== null).sort((a, b) => (b.lateDays ?? 0) * b.revenue12 - (a.lateDays ?? 0) * a.revenue12),
    todos: d.clients,
  };
  const list = lists[tab];

  return (
    <>
      <div className="head">
        <div>
          <div className="crumb"><Icon name="users" size={13} /> Clientes</div>
          <h1>Cartera de clientes</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Quién compra, quién dejó de comprar y en cuántos días te pagan de verdad. Todo sale de tus facturas de Colppy.</p>
        </div>
        <label className="inline-pick">
          <span className="muted small">Perdido después de</span>
          <select value={dias} onChange={(e) => pickDias(Number(e.target.value))}>
            {[60, 90, 120, 180].map((n) => <option key={n} value={n}>{n} días sin comprar</option>)}
          </select>
        </label>
      </div>

      {d.clients.length === 0 ? (
        <div className="card empty"><h2>Todavía no hay facturas de venta</h2><p>Cuando se actualicen los datos de Colppy, acá vas a ver tu cartera.</p></div>
      ) : (
        <>
          <div className="grid kpis">
            <Kpi label="Clientes activos" value={String(k.active)} sub={`${k.activeBefore} hace 90 días`} tone={k.active >= k.activeBefore ? "up" : "down"} />
            <Kpi label="Nuevos · últimos 90 días" value={String(k.new90)} sub={k.new90 ? `${short(k.newRevenue90)} facturados` : "ninguno"} tone={k.new90 ? "up" : "muted"} />
            <Kpi label="Perdidos · últimos 90 días" value={String(k.lost90)} sub={`Churn ${pct(k.churn)} del trimestre`} tone={k.churn > 0.1 ? "down" : k.lost90 ? "muted" : "up"} />
            <Kpi label="Recompra" value={pct(k.repeat)} sub="compraron en 2 meses o más" tone={k.repeat >= 0.6 ? "up" : "muted"} />
          </div>
          <div className="grid kpis" style={{ marginTop: 14 }}>
            <Kpi label="Días reales de cobro" value={k.realDays !== null ? `${k.realDays} días` : "—"} sub={k.realDays !== null ? `pactado ${k.agreedDays} · ${k.lateDays! > 0 ? `${k.lateDays} de atraso` : "en término"}` : "se completa con la próxima actualización"} tone={k.lateDays !== null && k.lateDays > 15 ? "down" : "muted"} />
            <Kpi label="DSO (días de calle)" value={k.dso !== null ? `${k.dso} días` : "—"} sub={k.dpo !== null ? `pagás a ${k.dpo} días (DPO)` : "saldo ÷ ventas diarias"} tone={k.dso !== null && k.dpo !== null && k.dso > k.dpo ? "down" : "muted"} />
            <Kpi label="Concentración" value={pct(k.top5Share)} sub={k.top1 ? `top 5 · ${k.top1.name} solo ${pct(k.top1.share)}` : "de la venta en tus 5 clientes"} tone={k.top5Share > 0.6 ? "down" : "muted"} />
            <Kpi label="Clientes recurrentes" value={String(k.recurring)} sub={k.recurring ? `compran todos los meses · ${short(k.recurringMonthly)} por mes` : "ninguno compró los últimos 3 meses"} tone="muted" />
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <h3>Clientes que entran y que se van · últimos 12 meses</h3>
            <Chart key={themeKey} type="bar"
              data={{
                labels: d.series.map((s) => mLabel(s.month)),
                datasets: [
                  { type: "bar" as const, label: "Nuevos", data: d.series.map((s) => s.new), backgroundColor: cssVar("--green"), borderRadius: 4, stack: "s" },
                  { type: "bar" as const, label: "Perdidos", data: d.series.map((s) => -s.lost), backgroundColor: cssVar("--red"), borderRadius: 4, stack: "s" },
                  { type: "line" as const, label: "Activos", data: d.series.map((s) => s.active), borderColor: cssVar("--blue"), backgroundColor: cssVar("--blue"), borderWidth: 2.5, pointRadius: 3, tension: 0.3, yAxisID: "y2" },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { labels: { color: cssVar("--text2"), boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.abs(Number(c.raw))}` } } },
                scales: {
                  x: { stacked: true, ticks: { color: cssVar("--text3") }, grid: { display: false } },
                  y: { stacked: true, ticks: { color: cssVar("--text3"), callback: (v) => Math.abs(Number(v)) }, grid: { color: cssVar("--chart-grid") }, title: { display: true, text: "nuevos / perdidos", color: cssVar("--text3") } },
                  y2: { position: "right", ticks: { color: cssVar("--text3") }, grid: { display: false }, title: { display: true, text: "activos", color: cssVar("--text3") } },
                },
              }}
            />
          </div>

          <div className="card" style={{ marginTop: 14, padding: 0 }}>
            <div className="tabs">
              {([["riesgo", `En riesgo (${d.atRisk.length})`], ["perdidos", `Perdidos en el año (${d.lost.length})`], ["cobro", "Días de cobro por cliente"], ["todos", `Todos (${d.clients.length})`]] as [Tab, string][]).map(([t, l]) => (
                <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{l}</button>
              ))}
            </div>
            <p className="muted small" style={{ padding: "10px 16px 0" }}>
              {tab === "riesgo" && "Siguen activos, pero hace bastante más que lo habitual que no compran. Es el momento de llamarlos."}
              {tab === "perdidos" && `Pasaron más de ${d.lostDays} días desde su última compra. Ordenados por lo que te compraban.`}
              {tab === "cobro" && `De la factura al cobro, según la fecha de cada recibo en Colppy (${pct(k.paidCoverage)} de las facturas cobradas ya tienen su fecha).`}
              {tab === "todos" && "Toda la cartera, ordenada por lo que te compró en los últimos 12 meses. Tocá un cliente para abrir su ficha completa."}
            </p>
            {list.length === 0 ? <p className="muted" style={{ padding: 16 }}>{tab === "riesgo" ? "Nadie en riesgo: todos compran a su ritmo de siempre." : "Nada para mostrar."}</p> : (
              <div className="table-wrap">
                <table className="table clickable">
                  <thead>
                    <tr>
                      <th>Cliente</th><th className="num">Venta 12 meses</th>
                      {tab === "cobro" ? <><th className="num">Pactado</th><th className="num">Real</th><th className="num">Atraso</th></>
                        : <><th className="num">Última compra</th><th className="num">Días sin comprar</th><th className="num">Compra cada</th></>}
                      <th className="num">Te debe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id} onClick={() => { window.location.href = `/app/clientes/${encodeURIComponent(c.id)}?company=${companyId}`; }}>
                        <td>{c.name}</td>
                        <td className="num">{short(c.revenue12)}</td>
                        {tab === "cobro" ? <>
                          <td className="num">{c.agreedDays} días</td>
                          <td className="num">{c.realDays} días</td>
                          <td className={`num ${(c.lateDays ?? 0) > 30 ? "down" : (c.lateDays ?? 0) > 7 ? "warn" : "up"}`}>{(c.lateDays ?? 0) > 0 ? `${c.lateDays} días` : "en término"}</td>
                        </> : <>
                          <td className="num">{dmy(c.last)}</td>
                          <td className={`num ${c.daysSince >= d.lostDays ? "down" : c.interval && c.daysSince > c.interval * 1.5 ? "warn" : ""}`}>{c.daysSince}</td>
                          <td className="num">{c.interval ? `${c.interval} días` : "—"}</td>
                        </>}
                        <td className="num">{c.pending > 1 ? short(c.pending) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            Activo = compró en los últimos {d.lostDays} días. Churn = perdidos de los últimos 90 días sobre los activos de hace 90 días. DSO = lo que te deben ÷ venta diaria de los últimos 90 días. Datos al {dmy(d.asOf)}.
          </p>
        </>
      )}
      {open && companyId && <PartyDrawer companyId={companyId} companyName={d.company.name} kind="clientes" partyId={open} onClose={() => setOpen(null)} onSent={load} />}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "up" | "down" | "muted" }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-sub ${tone}`}>{sub}</div>
    </div>
  );
}
