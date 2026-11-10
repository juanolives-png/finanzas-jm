"use client";
import { useState } from "react";
import Link from "next/link";

type Field = { name: string; label: string; type?: string; placeholder?: string };

export default function AuthForm({ mode }: { mode: "login" | "registro" }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fields: Field[] = mode === "registro"
    ? [
        { name: "empresa", label: "Nombre de tu empresa", placeholder: "Ej: Distribuidora Norte SRL" },
        { name: "nombre", label: "Tu nombre" },
        { name: "email", label: "Mail", type: "email" },
        { name: "password", label: "Contraseña", type: "password", placeholder: "Mínimo 8 caracteres" },
      ]
    : [
        { name: "email", label: "Mail", type: "email" },
        { name: "password", label: "Contraseña", type: "password" },
      ];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? "Algo salió mal"); setBusy(false); return; }
    window.location.href = mode === "registro" ? "/app/conexiones" : "/app";
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">Finanzas <span>JM</span></div>
        <p className="muted small" style={{ marginTop: 6 }}>
          {mode === "registro" ? "Creá tu cuenta y conectá tu sistema contable en 2 minutos." : "Entrá a tu tablero financiero."}
        </p>
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={f.name}>{f.label}</label>
            <input id={f.name} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} required />
          </div>
        ))}
        {error && <div className="error">{error}</div>}
        <button className="btn full" disabled={busy}>{busy ? "Un momento…" : mode === "registro" ? "Crear cuenta" : "Entrar"}</button>
        <p className="muted small" style={{ marginTop: 16, textAlign: "center" }}>
          {mode === "registro" ? <>¿Ya tenés cuenta? <Link href="/login" className="up">Entrá</Link></> : <>¿No tenés cuenta? <Link href="/registro" className="up">Creala gratis</Link></>}
        </p>
      </form>
    </div>
  );
}
