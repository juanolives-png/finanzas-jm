"use client";
// Ficha de un cliente / proveedor: comprobantes con saldo, historial de mails y el redactor
// (reclamo con tono según atraso, orden de pago o reclamo a proveedor) con vista previa real del mail.
import { useEffect, useMemo, useState } from "react";
import { defaultIntro, defaultSubject, docLabel, TONE_LABEL, toneFor, type MailKind, type Tone } from "@/lib/mailTemplates";
import type { Kind } from "@/lib/deuda";

type Doc = { id: string; docType: string; letter: string | null; number: string; date: string; dueDate: string | null; total: number; pending: number; late: number; description: string | null };
type Detail = {
  party: { id: string; name: string; alias: string | null; cuit: string | null; email: string | null; phone: string | null };
  docs: Doc[];
  mails: { at: string; kind: string; tone: string | null; to: string; subject: string; amount: number; ok: boolean; error: string | null }[];
};

const money = (n: number) => "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const todayIso = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
const KIND_LABEL: Record<string, string> = { reclamo_cliente: "Reclamo", orden_pago: "Orden de pago", reclamo_proveedor: "Reclamo a proveedor" };

export default function PartyDrawer({ companyId, companyName, kind, partyId, onClose, onSent }: { companyId: string; companyName: string; kind: Kind; partyId: string; onClose: () => void; onSent: () => void }) {
  const isCli = kind === "clientes";
  const [d, setD] = useState<Detail | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<MailKind | null>(null);
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  async function load() {
    const r = await fetch(`/api/deuda/parte?company=${companyId}&kind=${kind}&party=${encodeURIComponent(partyId)}`, { cache: "no-store" });
    const j: Detail = await r.json();
    setD(j);
    setEmail(j.party.email ?? "");
    // Clientes: se preseleccionan las vencidas (o todas si ninguna venció). Proveedores: lo vencido y lo que vence en 7 días.
    const pre = j.docs.filter((x) => x.pending > 0 && (isCli ? x.late > 0 : x.late >= -7));
    setSel(new Set((pre.length ? pre : j.docs.filter((x) => x.pending > 0)).map((x) => x.id)));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [partyId]);

  const chosen = useMemo(() => (d?.docs ?? []).filter((x) => sel.has(x.id)), [d, sel]);
  const chosenTotal = chosen.reduce((a, x) => a + x.pending, 0);

  async function saveEmail() {
    setSavingEmail(true);
    await fetch("/api/deuda/parte", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: companyId, kind, party: partyId, email }) });
    setSavingEmail(false);
    load(); onSent();
  }

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="drawer-bg" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        {!d ? <p className="muted">Cargando…</p> : (
          <>
            <div className="drawer-head">
              <div>
                <div className="crumb">{isCli ? "Cliente" : "Proveedor"}{d.party.cuit ? ` · CUIT ${d.party.cuit}` : ""}</div>
                <h2>{d.party.name}</h2>
              </div>
              <button className="link-btn" onClick={onClose} style={{ fontSize: 20 }}>×</button>
            </div>

            <div className="email-row">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@cliente.com (podés poner varios separados por coma)" />
              <button className="btn ghost sm" disabled={savingEmail || email === (d.party.email ?? "")} onClick={saveEmail}>{savingEmail ? "…" : "Guardar mail"}</button>
            </div>

            {mode ? (
              <Composer
                kind={mode} isCli={isCli} companyId={companyId} companyName={companyName} party={d.party} docs={chosen} total={chosenTotal} email={email}
                onBack={() => setMode(null)} onSent={() => { setMode(null); load(); onSent(); }}
              />
            ) : (
              <>
                <div className="table-wrap" style={{ marginTop: 14 }}>
                  <table className="table">
                    <thead><tr><th style={{ width: 28 }}></th><th>Comprobante</th><th>Vence</th><th className="num">Saldo</th><th className="num">{isCli ? "Atraso" : "Estado"}</th></tr></thead>
                    <tbody>
                      {d.docs.map((x) => (
                        <tr key={x.id} onClick={() => toggle(x.id)} style={{ cursor: "pointer" }}>
                          <td><input type="checkbox" checked={sel.has(x.id)} readOnly style={{ width: "auto" }} /></td>
                          <td><div className="mono">{docLabel(x)}</div><div className="muted small">{dmy(x.date)}{x.description ? ` · ${x.description.slice(0, 60)}` : ""}</div></td>
                          <td className="small">{dmy(x.dueDate)}</td>
                          <td className={`num mono ${x.pending < 0 ? "up" : ""}`}>{money(x.pending)}</td>
                          <td className="num small">{x.pending < 0 ? <span className="up">a favor</span> : x.late > 0 ? <span className={x.late > 60 ? "down" : ""}>{isCli ? `${x.late} días` : "vencida"}</span> : <span className="muted">{isCli ? "al día" : `en ${-x.late} días`}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="drawer-actions">
                  <div className="small">{chosen.length} comprobantes · <strong className="mono">{money(chosenTotal)}</strong></div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {isCli ? (
                      <button className="btn" disabled={!chosen.length} onClick={() => setMode("reclamo_cliente")}>✉ Reclamar deuda</button>
                    ) : (
                      <>
                        <button className="btn ghost" disabled={!chosen.length} onClick={() => setMode("reclamo_proveedor")}>Reclamar / consultar</button>
                        <button className="btn" disabled={!chosen.length} onClick={() => setMode("orden_pago")}>✉ Enviar orden de pago</button>
                      </>
                    )}
                  </div>
                </div>

                <h3 style={{ marginTop: 22 }}>Mails enviados</h3>
                {d.mails.length === 0 && <p className="muted small">Todavía no se le mandó nada desde Finanzas JM.</p>}
                {d.mails.map((m, i) => (
                  <div className="row" key={i}>
                    <span>{KIND_LABEL[m.kind] ?? m.kind}{m.tone ? ` · ${TONE_LABEL[m.tone as Tone] ?? m.tone}` : ""}<div className="muted small">{new Date(m.at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })} · {m.to}</div></span>
                    <span className={`mono small ${m.ok ? "" : "down"}`}>{m.ok ? money(m.amount) : "falló"}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function Composer({ kind, isCli, companyId, companyName, party, docs, total, email, onBack, onSent }: {
  kind: MailKind; isCli: boolean; companyId: string; companyName: string; party: Detail["party"]; docs: Doc[]; total: number; email: string; onBack: () => void; onSent: () => void;
}) {
  const maxLate = Math.max(0, ...docs.map((x) => x.late));
  const [tone, setTone] = useState<Tone>(toneFor(maxLate));
  const [payDate, setPayDate] = useState(todayIso());
  const [payAmount, setPayAmount] = useState<string>(String(Math.round(total * 100) / 100));
  const [to, setTo] = useState(email);
  const [cc, setCc] = useState("");
  const greeting0 = party.alias || party.name;
  const [greeting, setGreeting] = useState(greeting0);
  const [subject, setSubject] = useState(defaultSubject(kind, isCli ? tone : null, companyName, greeting0));
  const [intro, setIntro] = useState(defaultIntro(kind, isCli ? tone : null, payDate));
  const [html, setHtml] = useState("");
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Cambiar el tono (o la fecha de pago) reescribe asunto y texto
  useEffect(() => {
    setSubject(defaultSubject(kind, isCli ? tone : null, companyName, greeting0));
    setIntro(defaultIntro(kind, isCli ? tone : null, payDate));
  }, [tone, payDate, kind, isCli, companyName, greeting0]);

  const body = () => ({
    company: companyId, kind, party: party.id, docIds: docs.map((x) => x.id), to, cc, subject, greeting, intro,
    tone: isCli ? tone : null, payDate: kind === "orden_pago" ? payDate : null, payAmount: kind === "orden_pago" ? Number(payAmount) || null : null,
  });

  // Vista previa (con una pausa para no pedirla en cada tecla)
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch("/api/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body(), preview: true }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setHtml(j.html); setConfigured(j.configured); }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, greeting, intro, tone, payDate, payAmount, docs.length]);

  async function send() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body()) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error ?? "No se pudo enviar" });
    setMsg({ ok: true, text: "¡Enviado!" });
    setTimeout(onSent, 900);
  }

  const title = kind === "orden_pago" ? "Orden de pago" : kind === "reclamo_proveedor" ? "Reclamo a proveedor" : "Reclamo de deuda";
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{title} · {docs.length} comprobantes</h3>
        <button className="link-btn" onClick={onBack}>← Volver</button>
      </div>
      {!configured && <div className="notice" style={{ marginTop: 12 }}><span>Todavía no configuraste la casilla de envío. Podés ver la vista previa, pero para mandar andá a <a href={`/app/config/correo?company=${companyId}`} className="up">Configuración → Correo</a>.</span></div>}

      <div className="compose">
        {isCli && (
          <><label>Tono</label>
            <select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
              {(Object.keys(TONE_LABEL) as Tone[]).map((k) => <option key={k} value={k}>{TONE_LABEL[k]}{k === toneFor(maxLate) ? " · sugerido" : ""}</option>)}
            </select></>
        )}
        {kind === "orden_pago" && (
          <div className="two-col">
            <div><label>Fecha de pago</label><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
            <div><label>Importe del pago</label><input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mono" /></div>
          </div>
        )}
        <div className="two-col">
          <div><label>Para</label><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="mail@…" /></div>
          <div><label>CC</label><input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="opcional" /></div>
        </div>
        <label>Asunto</label><input value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label>Saludo (Hola …)</label><input value={greeting} onChange={(e) => setGreeting(e.target.value)} />
        <label>Texto</label><textarea rows={5} value={intro} onChange={(e) => setIntro(e.target.value)} />
      </div>

      <label>Vista previa</label>
      <iframe className="preview" srcDoc={html} title="Vista previa del mail" />

      {msg && <div className={msg.ok ? "ok" : "error"}>{msg.text}</div>}
      <div className="drawer-actions">
        <span className="muted small">Sale desde tu casilla, con copia a los CC por defecto.</span>
        <button className="btn" disabled={busy || !configured || !to} onClick={send}>{busy ? "Enviando…" : "Enviar"}</button>
      </div>
    </div>
  );
}
