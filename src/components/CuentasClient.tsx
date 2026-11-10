"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORIES, CATEGORY_KEYS, TEMPLATES, type Category } from "@/lib/categories";
import { Icon } from "@/components/Sidebar";

type Acc = { code: string; name: string; category: Category | null; debitOnly: boolean; source: string | null; aiReason: string | null; confirmed: boolean; debe: number; haber: number; movimientos: number };
type Resp = { company: { id: string; name: string }; template: string; accounts: Acc[]; aiEnabled: boolean };
type Filter = "revisar" | "sin" | "movimiento" | "todas";

const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)} k`;
  return Math.round(n).toString();
};
const SOURCE: Record<string, { label: string; cls: string }> = {
  plantilla: { label: "Plantilla", cls: "" },
  regla: { label: "Regla", cls: "" },
  ia: { label: "IA", cls: "purple" },
  cliente: { label: "Vos", cls: "green" },
};

export default function CuentasClient() {
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(params.get("company"));
  const [data, setData] = useState<Resp | null>(null);
  const [filter, setFilter] = useState<Filter>("revisar");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Sin ?company se usa la primera empresa del cliente
  useEffect(() => {
    if (companyId) return;
    fetch("/api/conexiones/colppy").then((r) => r.json()).then((j) => setCompanyId(j.companies?.[0]?.id ?? ""));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/cuentas?company=${companyId}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const accounts = data?.accounts ?? [];
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (t && !a.name.toLowerCase().includes(t) && !a.code.includes(t)) return false;
      if (filter === "sin") return a.category === null && a.movimientos > 0;
      if (filter === "revisar") return !a.confirmed && a.movimientos > 0 && a.category !== "PATRIMONIAL" && a.category !== "CAJA_BANCO";
      if (filter === "movimiento") return a.movimientos > 0;
      return true;
    });
  }, [accounts, filter, q]);

  const counts = {
    revisar: accounts.filter((a) => !a.confirmed && a.movimientos > 0 && a.category !== "PATRIMONIAL" && a.category !== "CAJA_BANCO").length,
    sin: accounts.filter((a) => a.category === null && a.movimientos > 0).length,
    movimiento: accounts.filter((a) => a.movimientos > 0).length,
    todas: accounts.length,
  };

  async function patch(updates: Partial<Acc & { code: string }>[]) {
    // optimista: se ve el cambio al instante
    setData((d) => d && { ...d, accounts: d.accounts.map((a) => { const u = updates.find((x) => x.code === a.code); return u ? { ...a, ...u, ...(u.category !== undefined ? { source: "cliente", confirmed: true } : {}) } : a; }) });
    const r = await fetch("/api/cuentas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: companyId, updates }) });
    if (!r.ok) { setMsg({ ok: false, text: "No se pudo guardar el cambio" }); load(); }
  }

  async function action(kind: "plantilla" | "ia", body: Record<string, unknown>) {
    setBusy(kind); setMsg(null);
    const r = await fetch(`/api/cuentas/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: companyId, ...body }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: j.error ?? "Algo salió mal" });
    setMsg({ ok: true, text: kind === "ia" ? `La IA revisó ${j.revisadas} cuentas y propuso ${j.propuestas}. Revisalas y confirmá.` : `Plantilla aplicada a ${j.reproposed} cuentas sin confirmar.` });
    load();
  }

  if (!data) return <p className="muted">Cargando…</p>;
  const net = (a: Acc) => a.haber - a.debe;

  return (
    <>
      <div className="head">
        <div>
          <div className="crumb"><Icon name="gear" size={13} /> Configuración</div>
          <h1>Plan de cuentas</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Cómo entra cada cuenta de {data.company.name} al resultado. Lo que confirmás no se vuelve a tocar.</p>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="kpi-label">1 · Criterio de partida</div>
          <select value={data.template} disabled={!!busy} onChange={(e) => action("plantilla", { template: e.target.value })} style={{ marginTop: 10 }}>
            {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
          <p className="muted small" style={{ marginTop: 8 }}>{TEMPLATES[data.template as keyof typeof TEMPLATES]?.help}</p>
        </div>
        <div className="card">
          <div className="kpi-label">2 · Que la IA proponga lo dudoso</div>
          <button className="btn" style={{ marginTop: 10, width: "100%" }} disabled={!!busy || !data.aiEnabled} onClick={() => action("ia", {})}>
            {busy === "ia" ? "La IA está revisando…" : "✦ Proponer con IA"}
          </button>
          <p className="muted small" style={{ marginTop: 8 }}>{data.aiEnabled ? "Revisa las cuentas sin categoría o resueltas por regla, siguiendo tu criterio." : "Falta configurar ANTHROPIC_API_KEY en el servidor."}</p>
        </div>
        <div className="card">
          <div className="kpi-label">3 · Revisar y confirmar</div>
          <div className="kpi-value">{counts.revisar}</div>
          <p className="muted small">cuentas con movimiento por revisar{counts.sin ? ` · ${counts.sin} sin categoría` : ""}</p>
        </div>
      </div>

      {msg && <div className={msg.ok ? "ok" : "error"} style={{ marginBottom: 14 }}>{msg.text}</div>}

      <div className="card" style={{ padding: 0 }}>
        <div className="toolbar">
          <div className="tabs">
            {([["revisar", "Por revisar"], ["sin", "Sin categoría"], ["movimiento", "Con movimiento"], ["todas", "Todas"]] as [Filter, string][]).map(([k, l]) => (
              <button key={k} className={`tab ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l} <span className="muted">{counts[k]}</span></button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Buscar cuenta…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
            {visible.some((a) => !a.confirmed && a.category) && (
              <button className="btn ghost" onClick={() => patch(visible.filter((a) => !a.confirmed && a.category).map((a) => ({ code: a.code, confirmed: true })))}>Confirmar las {visible.filter((a) => !a.confirmed && a.category).length} visibles</button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Cuenta</th><th className="num">Neto 12 meses</th><th>Categoría</th><th>Origen</th><th></th></tr>
            </thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24, textAlign: "center" }}>Nada por acá. {filter === "revisar" ? "¡Todo revisado!" : ""}</td></tr>}
              {visible.map((a) => {
                const patrimonial = /^[123]/.test(a.code);
                return (
                  <tr key={a.code} className={a.confirmed ? "" : "pending"}>
                    <td>
                      <div>{a.name}</div>
                      <div className="muted small mono">{a.code}{a.movimientos ? ` · ${a.movimientos} asientos` : ""}</div>
                      {a.aiReason && !a.confirmed && <div className="ai-reason">✦ {a.aiReason}</div>}
                    </td>
                    <td className={`num mono ${net(a) >= 0 ? "" : "muted"}`}>{a.movimientos ? short(net(a)) : "—"}</td>
                    <td>
                      <select value={a.category ?? ""} onChange={(e) => patch([{ code: a.code, category: (e.target.value || null) as Category | null }])} className={a.category ? "" : "warn"}>
                        <option value="">Sin categoría</option>
                        {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
                      </select>
                      {patrimonial && a.category && CATEGORIES[a.category].result && (
                        <label className="check">
                          <input type="checkbox" checked={a.debitOnly} onChange={(e) => patch([{ code: a.code, debitOnly: e.target.checked }])} /> Solo el debe (préstamos, aportes)
                        </label>
                      )}
                    </td>
                    <td>{a.source && <span className={`badge ${SOURCE[a.source]?.cls ?? ""}`}>{SOURCE[a.source]?.label ?? a.source}</span>}</td>
                    <td className="num">
                      {a.confirmed ? <span className="up small">✓ Confirmada</span>
                        : a.category ? <button className="btn ghost sm" onClick={() => patch([{ code: a.code, confirmed: true }])}>Confirmar</button> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
