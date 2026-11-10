"use client";
import { useEffect, useState } from "react";

type Company = { id: string; name: string; cuit: string | null; status: string; lastSyncAt: string | null; lastError: string | null; colppyUser: string | null };
type Empresa = { id: string; nombre: string; cuit: string | null };

// Los conectores que vienen. Se muestran para que el cliente vea el camino.
const NEXT = [
  { logo: "MP", name: "Mercado Pago", desc: "Cobros y saldo de tu cuenta, automático." },
  { logo: "🏦", name: "Bancos", desc: "Subí el extracto y lo conciliamos contra tu contabilidad." },
  { logo: "AR", name: "ARCA", desc: "Comprobantes emitidos y recibidos." },
];

export default function Conexiones() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await fetch("/api/conexiones/colppy", { cache: "no-store" });
    if (r.ok) setCompanies((await r.json()).companies);
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="head">
        <div>
          <h1>Conectar sistemas</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Conectás una vez y el tablero se actualiza solo todos los días.</p>
        </div>
      </div>

      {companies.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Empresas conectadas</h3>
          {companies.map((c) => (
            <div className="row" key={c.id}>
              <span>{c.name} <span className="muted small">· Colppy · {c.colppyUser}</span></span>
              <span>
                <span className={`badge ${c.status === "error" ? "red" : "green"}`}>{c.status === "error" ? "Con error" : "Conectada"}</span>{" "}
                <a href={`/app?company=${c.id}`} className="up small">Ver tablero →</a>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid connectors">
        <div className="card connector">
          <div className="logo" style={{ background: "#0d2e20", color: "#3ecf8e" }}>C</div>
          <strong>Colppy</strong>
          <p className="muted small">Tu contabilidad completa: ventas, compras, sueldos, impuestos, bancos.</p>
          {!open && <button className="btn" onClick={() => setOpen(true)}>{companies.length ? "Conectar otra empresa" : "Conectar"}</button>}
        </div>
        {NEXT.map((n) => (
          <div className="card connector" key={n.name}>
            <div className="logo">{n.logo}</div>
            <strong>{n.name}</strong>
            <p className="muted small">{n.desc}</p>
            <span className="badge">Próximamente</span>
          </div>
        ))}
      </div>

      {open && <ColppyWizard onClose={() => setOpen(false)} onDone={(id) => { window.location.href = `/app?company=${id}`; }} />}
    </>
  );
}

function ColppyWizard({ onClose, onDone }: { onClose: () => void; onDone: (companyId: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function probar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch("/api/conexiones/colppy/probar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, pass }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error ?? "No se pudo conectar");
    setEmpresas(j.empresas);
    setEmpresaId(j.empresas[0]?.id ?? "");
    setStep(2);
  }

  async function conectar() {
    const emp = empresas.find((x) => x.id === empresaId);
    if (!emp) return;
    setBusy(true); setError(null);
    const r = await fetch("/api/conexiones/colppy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, pass, empresaId, nombre: emp.nombre, cuit: emp.cuit }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); return setError(j.error ?? "No se pudo guardar"); }
    onDone(j.companyId);
  }

  return (
    <div className="card" style={{ marginTop: 14, maxWidth: 520 }}>
      <div className="steps"><div className="step on" /><div className={`step ${step === 2 ? "on" : ""}`} /></div>
      {step === 1 ? (
        <form onSubmit={probar}>
          <h3>Conectar Colppy · Paso 1: tu usuario</h3>
          <p className="muted small">Usá el mismo mail y contraseña con los que entrás a Colppy. Te recomendamos crear un usuario aparte para Finanzas JM. Solo leemos: no modificamos nada en tu Colppy.</p>
          <label>Usuario de Colppy (mail)</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} required autoComplete="off" />
          <label>Contraseña de Colppy</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="new-password" />
          {error && <div className="error">{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button className="btn" disabled={busy}>{busy ? "Probando conexión…" : "Continuar"}</button>
            <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      ) : (
        <div>
          <h3>Conectar Colppy · Paso 2: elegí la empresa</h3>
          {empresas.length === 0 ? <p className="muted small">Ese usuario no tiene empresas en Colppy.</p> : (
            <>
              <label>Empresa</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                {empresas.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.cuit ? ` · ${x.cuit}` : ""}</option>)}
              </select>
              <p className="muted small" style={{ marginTop: 10 }}>Vamos a traer los últimos 18 meses de tu contabilidad. Tarda unos minutos; podés ir mirando el tablero mientras.</p>
            </>
          )}
          {error && <div className="error">{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button className="btn" onClick={conectar} disabled={busy || !empresaId}>{busy ? "Conectando…" : "Conectar y traer datos"}</button>
            <button className="btn ghost" onClick={() => setStep(1)}>Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}
