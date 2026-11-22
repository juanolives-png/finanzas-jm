"use client";
// Clientes → Reclamos automáticos: qué días se reclama, desde qué atraso, a quién se avisa el día anterior,
// a quién se le reclamaría hoy (con opción de excluir clientes) e historial de avisos y envíos.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Sidebar";

type Cand = { partyId: string; name: string; email: string | null; excluded: boolean; skipReason: string | null; total: number; overdue: number; maxLate: number; tone: string; lastClaim: string | null; docs: unknown[] };
type Sched = { enabled: boolean; days: number[]; minLate: number; minAmount: number; cooldown: number; hour: number; notifyTo: string | null; pausedFor: string | null };
type Resp = {
  company: { id: string; name: string; demo: boolean };
  schedule: Sched; next: string | null; noticeDate: string | null; paused: boolean; mailReady: boolean; defaultNotify: string;
  candidates: Cand[];
  runs: { at: string; runDate: string; stage: string; ok: boolean; sent: number; failed: number; amount: number; error: string | null }[];
};
const WEEK = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const nice = (iso: string | null) => { if (!iso) return "—"; const d = new Date(`${iso}T12:00:00Z`); return `${WEEK[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`; };
const short = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$ ${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : a >= 1e3 ? `$ ${Math.round(v / 1e3)} k` : `$ ${Math.round(v)}`; };
const rec = (n: number) => `${n} ${n === 1 ? "reclamo" : "reclamos"}`;
const TONE: Record<string, string> = { RECORDATORIO: "Recordatorio amable", D30: "Atrasada (+30)", D60: "Más firme (+60)", D90: "Aviso de intereses (+90)" };
const STAGE: Record<string, string> = { aviso: "Aviso del día anterior", envio: "Envío", pausa: "Pausa" };

export default function ReclamosClient() {
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(params.get("company"));
  const [d, setD] = useState<Resp | null>(null);
  const [form, setForm] = useState<Sched | null>(null);
  const [notify, setNotify] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (companyId) return;
    fetch("/api/conexiones/colppy").then((r) => r.json()).then((j) => setCompanyId(j.companies?.find((c: { source: string }) => c.source !== "demo")?.id ?? j.companies?.[0]?.id ?? ""));
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/reclamos/config?company=${companyId}`, { cache: "no-store" });
    if (!r.ok) return;
    const j: Resp = await r.json();
    setD(j); setForm(j.schedule); setNotify(j.schedule.notifyTo ?? j.defaultNotify ?? "");
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function post(action: string, extra: Record<string, unknown> = {}, ok?: string) {
    setBusy(action); setMsg(null);
    const r = await fetch("/api/reclamos/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: companyId, action, ...extra }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: j.error ?? "No se pudo guardar" }); return; }
    if (ok) setMsg({ ok: true, text: ok });
    load();
  }
  const save = (enabled = form!.enabled) => post("save", { enabled, days: form!.days, minLate: form!.minLate, minAmount: form!.minAmount, cooldown: form!.cooldown, hour: form!.hour, notifyTo: notify },
    enabled ? "Guardado. Los reclamos se envían solos en las fechas elegidas." : "Guardado.");

  if (!d || !form) return <p className="muted">Cargando…</p>;
  const q = `?company=${companyId}`;
  const go = d.candidates.filter((c) => !c.skipReason), skip = d.candidates.filter((c) => c.skipReason);
  const total = go.reduce((a, c) => a + c.overdue, 0);
  const toggleDay = (n: number) => setForm({ ...form, days: form.days.includes(n) ? form.days.filter((x) => x !== n) : [...form.days, n].sort((a, b) => a - b) });

  return (
    <>
      <div className="head">
        <div>
          <div className="crumb"><Icon name="users" size={13} /> Clientes</div>
          <h1>Reclamos automáticos</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Numo reclama solo en las fechas que elijas. El día anterior te avisa para que dejes todo cargado, y antes de enviar vuelve a traer los datos de Colppy.</p>
        </div>
      </div>

      {msg && <div className={msg.ok ? "notice" : "error"} style={{ marginBottom: 14 }}>{msg.text}</div>}
      {!d.mailReady && <Link href="/app/config/correo" className="notice" style={{ marginBottom: 14 }}><span><strong>Falta configurar la casilla de envío.</strong> Los reclamos y el aviso salen desde tu mail.</span><span className="up">Configurar →</span></Link>}
      {d.company.demo && <div className="notice" style={{ marginBottom: 14 }}><span>Estás en la empresa demo: podés ver cómo funciona, pero no se envían reclamos de verdad.</span></div>}

      {/* Estado */}
      <div className={`card rc-status ${form.enabled ? (d.paused ? "paused" : "on") : ""}`}>
        {form.enabled && d.next ? (
          <>
            <div className="rc-steps">
              <div><span className="rc-n">1</span><b>Aviso · {nice(d.noticeDate)}, {form.hour} h</b><span className="muted small">a {form.notifyTo}: qué se va a enviar, para que dejen cargados los cobros.</span></div>
              <div><span className="rc-n">2</span><b>Actualiza Colppy · {nice(d.next)}</b><span className="muted small">justo antes de enviar, para no reclamarle a quien ya pagó.</span></div>
              <div><span className="rc-n">3</span><b>Envío · {nice(d.next)}, {form.hour} h</b><span className="muted small">{d.paused ? "Pausado: este envío no sale." : `Hoy serían ${rec(go.length)} por ${short(total)}.`}</span></div>
            </div>
            <div className="rc-actions">
              {d.paused ? <button className="btn" disabled={!!busy} onClick={() => post("resume", {}, "Envío reanudado.")}>Reanudar el envío</button>
                : <button className="btn ghost" disabled={!!busy} onClick={() => post("pause", {}, "Listo: el próximo envío quedó pausado.")}>⏸ Pausar este envío</button>}
              <button className="btn ghost" disabled={!!busy || !d.mailReady || d.company.demo} onClick={() => post("test", {}, `Te mandamos el aviso a ${form.notifyTo}. Revisá tu bandeja.`)}>{busy === "test" ? "Enviando…" : "Mandarme el aviso ahora (prueba)"}</button>
            </div>
          </>
        ) : (
          <div className="rc-off">
            <div><b>Los reclamos automáticos están apagados.</b><p className="muted small" style={{ marginTop: 4 }}>Elegí los días, a quién avisar y activalos. Mientras tanto podés reclamar a mano desde Deuda y reclamos.</p></div>
            <button className="btn" disabled={!!busy || d.company.demo} onClick={() => save(true)}>Activar</button>
          </div>
        )}
      </div>

      <div className="grid two" style={{ marginTop: 14 }}>
        {/* Configuración */}
        <div className="card">
          <h3>Cómo y cuándo</h3>
          <label>Días del mes en que se reclama</label>
          <div className="rc-days">{Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <button key={n} className={form.days.includes(n) ? "on" : ""} onClick={() => toggleDay(n)}>{n}</button>)}</div>
          <p className="muted small" style={{ marginTop: 6 }}>{form.days.length ? `Se envía los días ${form.days.join(", ")} de cada mes (si cae 31 en un mes más corto, el último día).` : "Elegí al menos un día."}</p>
          <div className="two-col">
            <div><label>Reclamar desde (días de atraso)</label><input type="number" min={0} value={form.minLate} onChange={(e) => setForm({ ...form, minLate: Number(e.target.value) })} /></div>
            <div><label>Hora del aviso y del envío</label><select value={form.hour} onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => i + 7).map((h) => <option key={h} value={h}>{h}:00</option>)}</select></div>
          </div>
          <div className="two-col">
            <div><label>Vencido mínimo para reclamar ($)</label><input type="number" min={0} value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: Number(e.target.value) })} /></div>
            <div><label>No repetir si se reclamó hace menos de (días)</label><input type="number" min={0} value={form.cooldown} onChange={(e) => setForm({ ...form, cooldown: Number(e.target.value) })} /></div>
          </div>
          <label>Aviso del día anterior y resumen, a</label>
          <input value={notify} onChange={(e) => setNotify(e.target.value)} placeholder="administracion@tuempresa.com, socio@…" />
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn" disabled={!!busy} onClick={() => save()}>{busy === "save" ? "Guardando…" : "Guardar"}</button>
            {form.enabled && <button className="btn ghost" disabled={!!busy} onClick={() => save(false)}>Apagar reclamos automáticos</button>}
          </div>
        </div>

        {/* Historial */}
        <div className="card">
          <h3>Historial</h3>
          {d.runs.length === 0 && <p className="muted small">Todavía no hubo avisos ni envíos.</p>}
          <div className="ftime">
            {d.runs.map((r, i) => (
              <div key={i} className={`ft ${r.ok ? "" : "bad"}`}>
                <b>{STAGE[r.stage] ?? r.stage}</b> · envío del {nice(r.runDate)}
                <div className="muted small">
                  {r.stage === "envio" && r.ok !== false ? `${r.sent} reclamos por ${short(r.amount)}${r.failed ? ` · ${r.failed} fallaron` : ""}` : r.stage === "aviso" && r.ok ? `${r.sent} reclamos anunciados por ${short(r.amount)}` : r.error}
                  {" · "}{new Date(r.at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* A quién */}
      <div className="card" style={{ marginTop: 14, padding: 0 }}>
        <h3 style={{ padding: "16px 16px 0" }}>Si el envío fuera hoy · {rec(go.length)} por {short(total)}</h3>
        <p className="muted small" style={{ padding: "4px 16px 0" }}>Apagá a un cliente para que nunca se le reclame solo (por ejemplo, si tiene un acuerdo de pago). Tocá el nombre para ver su ficha.</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cliente</th><th className="num">Vencido</th><th className="num">Atraso</th><th>Tono</th><th>Mail</th><th>Estado</th><th>Automático</th></tr></thead>
            <tbody>
              {[...go, ...skip].map((c) => (
                <tr key={c.partyId}>
                  <td><Link href={`/app/clientes/${encodeURIComponent(c.partyId)}${q}`} className="up">{c.name}</Link></td>
                  <td className="num">{short(c.overdue)}</td>
                  <td className={`num ${c.maxLate > 60 ? "down" : "warn"}`}>{c.maxLate} días</td>
                  <td>{TONE[c.tone] ?? c.tone}</td>
                  <td className="small">{c.email ?? <span className="down">sin mail</span>}</td>
                  <td className="small">{c.skipReason ? <span className="muted">No: {c.skipReason}</span> : <span className="up">Se le reclama</span>}</td>
                  <td><label className="switch"><input type="checkbox" checked={!c.excluded} onChange={(e) => post("save", { party: c.partyId, autoClaim: e.target.checked })} /><i /></label></td>
                </tr>
              ))}
              {d.candidates.length === 0 && <tr><td colSpan={7} className="muted">Ningún cliente tiene facturas vencidas desde {form.minLate} días. 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
