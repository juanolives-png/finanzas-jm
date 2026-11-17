"use client";
import { useState } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { OB_STORAGE } from "@/lib/onboarding";

type Field = { name: string; label: string; type?: string; placeholder?: string; auto?: string };

export default function AuthForm({ mode }: { mode: "login" | "registro" }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fields: Field[] = mode === "registro"
    ? [
        { name: "empresa", label: "Nombre de tu empresa", placeholder: "Ej: Distribuidora Norte SRL", auto: "organization" },
        { name: "nombre", label: "Tu nombre", auto: "name" },
        { name: "email", label: "Mail", type: "email", auto: "email" },
        { name: "password", label: "Contraseña", type: "password", placeholder: "Mínimo 8 caracteres", auto: "new-password" },
      ]
    : [
        { name: "email", label: "Mail", type: "email", auto: "email" },
        { name: "password", label: "Contraseña", type: "password", auto: "current-password" },
      ];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? "Algo salió mal"); setBusy(false); return; }
    if (mode === "registro") {
      // Lo que eligió en "¿Qué querés ver de tu empresa?" antes de tener cuenta
      try {
        const saved = localStorage.getItem(OB_STORAGE);
        if (saved) {
          await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: saved });
          localStorage.removeItem(OB_STORAGE);
        }
      } catch { /* si falla, se puede elegir de nuevo */ }
    }
    window.location.href = mode === "registro" ? "/app/conexiones" : "/app";
  }

  return (
    <div className="auth">
      <aside className="auth-brand">
        <Wordmark height={30} />
        <div>
          <Mark size={88} />
          <h2>Numo mira los números para que vos mires tu negocio.</h2>
          <p>Se conecta a tu sistema contable y te muestra, todos los días, cuánto vendiste, cuánto te queda y quién te debe.</p>
          <p className="claim">Menos tiempo en planillas. Más tiempo en tu empresa.</p>
        </div>
        <span style={{ color: "#6F837A", fontSize: 13 }}>@numo.finanzas</span>
      </aside>

      <div className="auth-form">
        <form className="auth-card" onSubmit={submit}>
          <h1>{mode === "registro" ? "Creá tu cuenta" : "Entrá a Numo"}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {mode === "registro" ? "Conectás tu sistema contable en 2 minutos." : "Tu tablero te está esperando."}
          </p>
          {fields.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name}>{f.label}</label>
              <input id={f.name} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} autoComplete={f.auto} required />
            </div>
          ))}
          {error && <div className="error">{error}</div>}
          <button className="btn full" disabled={busy}>{busy ? "Un momento…" : mode === "registro" ? "Crear cuenta" : "Entrar"}</button>
          <p className="muted small" style={{ marginTop: 18, textAlign: "center" }}>
            {mode === "registro"
              ? <>¿Ya tenés cuenta? <Link href="/login" className="up">Entrá</Link></>
              : <>¿No tenés cuenta? <Link href="/empezar" className="up">Creala gratis</Link></>}
          </p>
        </form>
      </div>
    </div>
  );
}
