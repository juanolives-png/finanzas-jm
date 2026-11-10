"use client";
// Configuración → Correo: la casilla desde la que salen reclamos y órdenes de pago, firma y datos de cobro.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Sidebar";

type Cfg = { smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; fromName: string; replyTo: string; ccDefault: string; signature: string; bankInfo: string; brandColor: string; hasPassword?: boolean };
const EMPTY: Cfg = { smtpHost: "smtp.gmail.com", smtpPort: 465, smtpUser: "", smtpPass: "", fromName: "", replyTo: "", ccDefault: "", signature: "", bankInfo: "", brandColor: "#131c4a" };

export default function CorreoClient() {
  const [c, setC] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/config/correo").then((r) => r.json()).then((j) => {
      const x = j.config ?? {};
      setC({ ...EMPTY, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v !== null)), smtpPass: "" } as Cfg);
    });
  }, []);
  if (!c) return <p className="muted">Cargando…</p>;
  const set = (k: keyof Cfg) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });

  async function save() {
    setBusy("save"); setMsg(null);
    const r = await fetch("/api/config/correo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: "No se pudo guardar" });
    setC({ ...c!, smtpPass: "", hasPassword: c!.hasPassword || !!c!.smtpPass });
    setMsg({ ok: true, text: "Guardado." });
  }
  async function test() {
    setBusy("test"); setMsg(null);
    const r = await fetch("/api/config/correo/test", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: `Te mandamos un mail de prueba a ${j.to}. ¡Revisá tu bandeja!` } : { ok: false, text: j.error ?? "No se pudo enviar" });
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="crumb"><Icon name="gear" size={13} /> Configuración</div>
          <h1>Correo y datos de cobro</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Los reclamos y las órdenes de pago salen desde tu casilla, con tu nombre.</p>
        </div>
      </div>

      <div className="grid two-even">
        <div className="card">
          <h3>Casilla de envío</h3>
          <p className="muted small">Con Gmail o Google Workspace: activá la verificación en dos pasos y creá una <strong>contraseña de aplicación</strong> en myaccount.google.com → Seguridad → Contraseñas de aplicaciones. Pegá esa clave acá (no tu contraseña normal).</p>
          <label>Mail que envía</label><input value={c.smtpUser} onChange={set("smtpUser")} placeholder="administracion@tuempresa.com" />
          <label>Contraseña de aplicación {c.hasPassword && <span className="up">· ya guardada</span>}</label>
          <input type="password" value={c.smtpPass} onChange={set("smtpPass")} placeholder={c.hasPassword ? "Dejala vacía para no cambiarla" : "xxxx xxxx xxxx xxxx"} autoComplete="new-password" />
          <label>Nombre que ve el destinatario</label><input value={c.fromName} onChange={set("fromName")} placeholder="Administración — Tu Empresa" />
          <div className="two-col">
            <div><label>Responder a</label><input value={c.replyTo} onChange={set("replyTo")} placeholder="opcional" /></div>
            <div><label>CC en todos los mails</label><input value={c.ccDefault} onChange={set("ccDefault")} placeholder="socio@…, contador@…" /></div>
          </div>
          <details style={{ marginTop: 12 }}>
            <summary className="muted small" style={{ cursor: "pointer" }}>Otro proveedor de correo (SMTP)</summary>
            <div className="two-col">
              <div><label>Servidor</label><input value={c.smtpHost} onChange={set("smtpHost")} /></div>
              <div><label>Puerto</label><input value={String(c.smtpPort)} onChange={(e) => setC({ ...c, smtpPort: Number(e.target.value) || 465 })} /></div>
            </div>
          </details>
        </div>

        <div className="card">
          <h3>Cómo se ven tus mails</h3>
          <label>Datos para transferir (van en los reclamos a clientes)</label>
          <textarea rows={5} value={c.bankInfo} onChange={set("bankInfo")} placeholder={"Banco Galicia\nCBU 0070000000000000000000\nAlias TU.EMPRESA.COBROS\nTitular: Tu Empresa SRL · CUIT 30-00000000-0"} />
          <label>Firma</label>
          <textarea rows={3} value={c.signature} onChange={set("signature")} placeholder={"Saludos,\nJuan Olives\nAdministración"} />
          <label>Color del encabezado</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={c.brandColor} onChange={set("brandColor")} style={{ width: 54, height: 38, padding: 2 }} />
            <span className="mono small muted">{c.brandColor}</span>
          </div>
        </div>
      </div>

      {msg && <div className={msg.ok ? "ok" : "error"}>{msg.text}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="btn" onClick={save} disabled={!!busy}>{busy === "save" ? "Guardando…" : "Guardar"}</button>
        <button className="btn ghost" onClick={test} disabled={!!busy || !c.smtpUser || (!c.hasPassword && !c.smtpPass)}>{busy === "test" ? "Enviando…" : "Mandarme un mail de prueba"}</button>
      </div>
    </>
  );
}
