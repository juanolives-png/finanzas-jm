"use client";
// Ficha del cliente: todo en un lugar. Cómo está hoy, qué compra, cómo paga, cuándo se le reclamó,
// notas y acuerdos, y si entra en los reclamos automáticos. Desde acá se le manda el reclamo.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Sidebar";
import PartyDrawer from "@/components/PartyDrawer";

type Ficha = {
  company: { id: string; name: string; rubro: string | null };
  party: { id: string; name: string; alias: string | null; cuit: string | null; email: string | null; emailManual: boolean; phone: string | null; address: string | null; ivaCondition: string | null; autoClaim: boolean };
  status: string;
  kpis: { balance: number; overdue: number; maxLate: number; revenue12: number; invoices12: number; first: string | null; last: string | null; daysSince: number | null; interval: number | null; realDays: number | null; agreedDays: number | null; lateDays: number | null; avgTicket: number };
  months: { month: string; total: number }[];
  pending: { id: string; label: string; date: string; dueDate: string | null; total: number; pending: number; late: number; electronic: boolean }[];
  recent: { id: string; label: string; date: string; total: number; pending: number; paidAt: string | null; description: string | null; electronic: boolean }[];
  claims: { at: string; tone: string | null; to: string; amount: number; ok: boolean; error: string | null; auto: boolean }[];
  notes: { id: string; text: string; author: string; at: string }[];
  auto: { enabled: boolean; next: string | null; willClaim: boolean; reason: string | null };
};

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const short = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$ ${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : a >= 1e3 ? `$ ${Math.round(v / 1e3)} k` : money(v); };
const dmy = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
const days = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
const TONE: Record<string, string> = { RECORDATORIO: "Recordatorio", D30: "+30 días", D60: "+60 días", D90: "+90 días" };
const STATUS: Record<string, string> = { activo: "green", "en riesgo": "purple", perdido: "red", "sin compras": "" };

export default function FichaClient({ party }: { party: string }) {
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(params.get("company"));
  const [f, setF] = useState<Ficha | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [editMail, setEditMail] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (companyId) return;
    fetch("/api/conexiones/colppy").then((r) => r.json()).then((j) => setCompanyId(j.companies?.find((c: { source: string }) => c.source !== "demo")?.id ?? j.companies?.[0]?.id ?? ""));
  }, [companyId]);
  const load = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/clientes/ficha?company=${companyId}&party=${encodeURIComponent(party)}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "No se pudo cargar"); return; }
    setF(j); setEmail(j.party.email ?? "");
  }, [companyId, party]);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    const r = await fetch("/api/clientes/ficha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: companyId, party, ...body }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { alertMsg(j.error ?? "No se pudo guardar"); return false; }
    await load();
    return true;
  }
  const [msg, setMsg] = useState<string | null>(null);
  const alertMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  if (err) return <div className="card empty"><h2>No encontramos ese cliente</h2><p>{err}</p><Link href="/app/clientes" className="btn">Volver a clientes</Link></div>;
  if (!f) return <p className="muted">Cargando…</p>;
  const k = f.kpis, q = `?company=${companyId}`;
  const max = Math.max(1, ...f.months.map((m) => m.total));

  return (
    <>
      <div className="head">
        <div>
          <div className="crumb"><Icon name="users" size={13} /> <Link href={`/app/clientes${q}`}>Clientes</Link> · Ficha</div>
          <h1>{f.party.name}</h1>
          <p className="muted small" style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`badge ${STATUS[f.status] ?? ""}`}>{f.status[0].toUpperCase() + f.status.slice(1)}</span>
            {f.party.cuit && <span>CUIT {f.party.cuit}</span>}{f.party.ivaCondition && <span>· {f.party.ivaCondition}</span>}{k.first && <span>· cliente desde {dmy(k.first)}</span>}
          </p>
        </div>
        <div className="head-actions">
          {k.balance > 1 && <button className="btn" onClick={() => setDrawer(true)}>Mandar reclamo</button>}
          <Link href={`/app/clientes/analisis${q}`} className="btn ghost">Cartera</Link>
        </div>
      </div>
      {msg && <div className="error" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="grid kpis">
        <Kpi label="Te debe" value={k.balance > 1 ? short(k.balance) : "Nada"} sub={k.overdue > 1 ? `${short(k.overdue)} vencido · ${k.maxLate} días de atraso` : "al día"} tone={k.overdue > 1 ? (k.maxLate > 60 ? "down" : "warn") : "up"} />
        <Kpi label="Te compró en 12 meses" value={short(k.revenue12)} sub={`${k.invoices12} facturas · ticket ${short(k.avgTicket)}`} tone="muted" />
        <Kpi label="Última compra" value={k.last ? dmy(k.last) : "—"} sub={k.daysSince !== null ? `hace ${k.daysSince} días${k.interval ? ` · compra cada ${k.interval}` : ""}` : "sin compras"} tone={k.interval && k.daysSince !== null && k.daysSince > k.interval * 1.5 ? "warn" : "muted"} />
        <Kpi label="Te paga a" value={k.realDays !== null ? `${k.realDays} días` : "—"} sub={k.realDays !== null ? `pactado ${k.agreedDays} · ${k.lateDays! > 0 ? `${k.lateDays} de atraso` : "en término"}` : "se completa al actualizar"} tone={k.lateDays !== null && k.lateDays > 15 ? "down" : "muted"} />
      </div>

      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Compras de los últimos 12 meses</h3>
          <div className="fbars">
            {f.months.map((m) => (
              <div key={m.month} className="fbar" title={`${MESES[+m.month.slice(5) - 1]}: ${money(m.total)}`}>
                <i style={{ height: `${Math.max(2, (m.total / max) * 100)}%`, opacity: m.total ? 1 : 0.25 }} />
                <span>{MESES[+m.month.slice(5) - 1][0]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Contacto y reclamos automáticos</h3>
          <div className="row"><span className="muted">Mail de cobranzas</span>
            {editMail ? (
              <span style={{ display: "flex", gap: 6 }}><input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: 220, padding: "5px 8px" }} placeholder="pagos@cliente.com" />
                <button className="btn sm" disabled={busy} onClick={async () => { if (await act({ action: "email", email })) setEditMail(false); }}>Guardar</button></span>
            ) : <span>{f.party.email ?? <i className="muted">sin mail</i>} <button className="link-btn up" onClick={() => setEditMail(true)}>editar</button></span>}
          </div>
          {f.party.phone && <div className="row"><span className="muted">Teléfono</span><span>{f.party.phone}</span></div>}
          {f.party.address && <div className="row"><span className="muted">Dirección</span><span>{f.party.address}</span></div>}
          <div className="row" style={{ alignItems: "center" }}>
            <span>
              <b>Reclamos automáticos</b>
              <div className="muted small">
                {!f.auto.enabled ? <>Todavía no están activados. <Link href={`/app/clientes/reclamos${q}`} className="up">Configurar</Link></>
                  : !f.party.autoClaim ? "Excluido: nunca se le reclama solo."
                  : f.auto.willClaim ? `Se le reclama el ${dmy(f.auto.next)}.` : `Próximo envío ${dmy(f.auto.next)}: no entra (${f.auto.reason}).`}
              </div>
            </span>
            <label className="switch"><input type="checkbox" checked={f.party.autoClaim} disabled={busy} onChange={(e) => act({ action: "auto", value: e.target.checked })} /><i /></label>
          </div>
        </div>
      </div>

      {f.pending.length > 0 && (
        <div className="card" style={{ marginTop: 14, padding: 0 }}>
          <h3 style={{ padding: "16px 16px 0" }}>Facturas pendientes</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Comprobante</th><th>Fecha</th><th>Vence</th><th className="num">Total</th><th className="num">Saldo</th><th className="num">Atraso</th></tr></thead>
              <tbody>
                {f.pending.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.label}{d.electronic ? <a className="pdf-link" href={`/api/factura/pdf?company=${companyId}&doc=${d.id}`} target="_blank" rel="noreferrer">PDF</a> : <span className="no-pdf">sin factura ARCA</span>}</td>
                    <td>{dmy(d.date)}</td><td>{dmy(d.dueDate)}</td><td className="num">{money(d.total)}</td><td className="num">{money(d.pending)}</td>
                    <td className={`num ${d.late > 60 ? "down" : d.late > 0 ? "warn" : ""}`}>{d.pending < 0 ? "a favor" : d.late > 0 ? `${d.late} días` : `vence en ${-d.late}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid two-even" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Notas y acuerdos</h3>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: habló con Marta, transfiere el viernes · paga los 10 de cada mes" />
          <button className="btn sm" style={{ marginTop: 8 }} disabled={busy || !note.trim()} onClick={async () => { if (await act({ action: "note", text: note })) setNote(""); }}>Guardar nota</button>
          <div className="fnotes">
            {f.notes.length === 0 && <p className="muted small" style={{ marginTop: 12 }}>Sin notas todavía. Lo que anotes acá lo ve todo el equipo.</p>}
            {f.notes.map((n) => (
              <div key={n.id} className="fnote">
                <p>{n.text}</p>
                <span className="muted small">{n.author} · {new Date(n.at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })} · <button className="link-btn small" onClick={() => act({ action: "delnote", noteId: n.id })}>borrar</button></span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Reclamos enviados</h3>
          {f.claims.length === 0 && <p className="muted small">Nunca se le mandó un reclamo desde Numo.</p>}
          <div className="ftime">
            {f.claims.map((c, i) => (
              <div key={i} className={`ft ${c.ok ? "" : "bad"}`}>
                <b>{new Date(c.at).toLocaleDateString("es-AR")}</b> · {TONE[c.tone ?? ""] ?? "Reclamo"} por {short(c.amount)} {c.auto && <span className="badge">automático</span>}
                <div className="muted small">{c.ok ? `a ${c.to}` : `no salió: ${c.error}`}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 0 }}>
        <h3 style={{ padding: "16px 16px 0" }}>Últimas facturas</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Comprobante</th><th>Fecha</th><th>Detalle</th><th className="num">Total</th><th className="num">Cobrada</th></tr></thead>
            <tbody>
              {f.recent.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.label}</td><td>{dmy(d.date)}</td><td className="muted small">{d.description?.slice(0, 60) ?? "—"}</td><td className="num">{money(d.total)}</td>
                  <td className="num">{Math.abs(d.pending) <= 1 ? (d.paidAt ? `${dmy(d.paidAt)} · ${days(d.paidAt, d.date)} días` : "sí") : <span className="warn">pendiente</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && companyId && <PartyDrawer companyId={companyId} companyName={f.company.name} kind="clientes" partyId={party} onClose={() => setDrawer(false)} onSent={load} />}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "up" | "down" | "muted" | "warn" }) {
  return <div className="card"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className={`kpi-sub ${tone}`}>{sub}</div></div>;
}
