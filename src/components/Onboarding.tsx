"use client";
// ─── Inicio mágico: "¿Qué querés ver de tu empresa?" ─────────────────────────
// 1. El cliente escribe (o toca sugerencias) y aprieta Enter.
// 2. Numo responde escribiendo y propone módulos (se pueden sacar). Si pide algo que no conoce, lo anota igual.
// 3. "Sí, armalo": chispas y cada pieza del sistema vuela desde el centro a su lugar.
// 4. Queda armado y se puede recorrer: cada sección explica qué responde y deja abrir los números;
//    se sacan o suman secciones y se pone el nombre de la empresa (ObPreview).
// 5. Se guardan módulos, pedidos y nombre; al crear la cuenta entra con su Numo armado y la empresa demo.
import { useEffect, useRef, useState } from "react";
import { Mark, Wordmark } from "@/components/Logo";
import { detectModules, OB_DEFAULT, OB_MODULES, OB_STORAGE, type ObModule } from "@/lib/onboarding";
import ObPreview from "@/components/ObPreview";
import type { DemoPreview } from "@/lib/demoPreview";

type Msg = { id: number; who: "user" | "bot"; text: string; typing?: string; mods?: string[]; ask?: string; actions?: boolean };

const IC: Record<string, string> = {
  dash: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", pyl: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  caja: "M3 7h18v12H3zM3 11h18M7 15h3", cli: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  fac: "M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4", prov: "M1 4h14v11H1zm14 4h4l3 3v4h-7", iva: "M19 5 5 19M7 7h.01M17 17h.01",
  soc: "M4 4h16v12H4zM8 20h8M12 16v4", ppto: "M12 3v9l6 3M21 12a9 9 0 1 1-9-9", ia: "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z",
  stock: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  cap: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", ciclo: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5", eq: "M3 17l6-6 4 4 8-8M14 7h7v7", x: "M12 5v14M5 12h14",
};
const Ico = ({ k }: { k: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={IC[k] ?? IC.x} /></svg>
);
const SUGGESTIONS = ["Quiero un dashboard financiero", "Quiero tener un P&L", "Llevar las cobranzas y la facturación", "Controlar a mis proveedores", "Saber cuánta caja voy a tener", "Ver mi capital de trabajo", "Controlar el stock", "Mandar un reporte a mis socios"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Onboarding({ loggedIn, preview }: { loggedIn: boolean; preview: DemoPreview }) {
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ObModule[]>(OB_MODULES);
  const [wishes, setWishes] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState("dash");
  const [company, setCompany] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const upd = (id: number, patch: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  async function typeInto(id: number, key: "text" | "ask", text: string) {
    for (let i = 1; i <= text.length; i += 2) { upd(id, { [key]: text.slice(0, i), typing: key }); await sleep(16); }
    upd(id, { [key]: text, typing: undefined });
  }

  async function submit() {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true); setQ("");
    setWishes((w) => [...w, text]);
    const userId = ++idRef.current;
    setMsgs((m) => [...m.map((x) => ({ ...x, actions: false })), { id: userId, who: "user", text }]);

    const isFirst = chosen.length === 0;
    let found = detectModules(text);
    let cat = catalog;
    let custom: ObModule | null = null;
    // Si no reconoce nada (y no es el primer mensaje), igual lo anota: arma una tarjeta con lo que pidió
    if (!found.length && !isFirst) {
      const label = text.replace(/^((quiero|me gustaria|me gustaría|tambien|también|agrega|agregá|agregar|sumale|sumá|ver|tener|saber|una|un|el|la|los|las|mi|mis|tarjeta|de)\s+)+/i, "").replace(/[.!?]+$/, "").slice(0, 42);
      custom = { id: "x" + idRef.current, label: label.charAt(0).toUpperCase() + label.slice(1), kw: [], custom: true };
      cat = [...catalog, custom]; setCatalog(cat); found = [custom.id];
    }
    const next = Array.from(new Set([...chosen, ...(found.length ? found : isFirst ? OB_DEFAULT : []), "dash"]));
    const added = found.filter((x) => !chosen.includes(x));
    setChosen(next);

    const botId = ++idRef.current;
    setMsgs((m) => [...m, { id: botId, who: "bot", text: "" }]);
    await sleep(450);
    const line = custom ? `Todavía no tengo una sección de “${custom.label.toLowerCase()}”, pero la anoto y te armo una tarjeta para eso. Así quedaría tu Numo:`
      : !isFirst ? (added.length ? "Listo, lo sumo. Así quedaría tu Numo:" : "Eso ya lo tenés. Así quedaría tu Numo:")
      : found.length ? "¡Perfecto! Te propongo armar tu Numo con estas secciones. Tocá cualquiera para sacarla:"
      : "Entiendo. Para arrancar, a la mayoría de las empresas les sirve esto. Tocá cualquiera para sacarla:";
    await typeInto(botId, "text", line);
    upd(botId, { mods: next });
    await sleep(250 + next.length * 80);
    const extra = cat.filter((m) => !next.includes(m.id) && !m.custom).slice(0, 3).map((m) => m.label.toLowerCase());
    await typeInto(botId, "ask", `¿Lo armo así, o querés agregar algo más${extra.length ? ` (por ejemplo ${extra.join(", ")})` : ""}?`);
    upd(botId, { actions: true });
    setBusy(false);
  }

  const toggle = (id: string) => { if (id === "dash") return; setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])); };

  // ── El armado: cada pieza arranca en el centro, chiquita y girada, y vuela a su lugar ──
  function build() {
    setActive("dash"); setDone(false);
    setBuilding(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const app = appRef.current;
      if (!app) return;
      const cx = innerWidth / 2, cy = innerHeight / 2;
      for (let i = 0; i < 46; i++) {
        const s = document.createElement("i"); s.className = "ob-spark";
        const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * Math.max(innerWidth, innerHeight) * 0.45;
        s.style.left = cx + "px"; s.style.top = cy + "px"; s.style.background = ["#4FB383", "#D9A63E", "#E5EEE9"][i % 3];
        document.body.appendChild(s);
        s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(.2)`, opacity: 0 }],
          { duration: 900 + Math.random() * 600, easing: "cubic-bezier(.2,.7,.2,1)" }).onfinish = () => s.remove();
      }
      app.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: 250, fill: "both", easing: "cubic-bezier(.2,.8,.2,1)" });
      const pieces = [...app.querySelectorAll<HTMLElement>(".ob-fly")];
      pieces.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2), rot = (Math.random() - 0.5) * 50;
        el.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(.15) rotate(${rot}deg)`, opacity: 0 },
          { transform: `translate(${dx * -0.08}px, ${dy * -0.08}px) scale(1.04) rotate(${rot * -0.1}deg)`, opacity: 1, offset: 0.75 },
          { transform: "none", opacity: 1 },
        ], { duration: 900, delay: 200 + i * 55, fill: "both", easing: "cubic-bezier(.2,.8,.2,1)" });
      });
      setTimeout(() => setDone(true), 400 + pieces.length * 55 + 900);
    }));
  }

  async function finish() {
    setSaving(true);
    const custom = catalog.filter((m) => m.custom && chosen.includes(m.id)).map((m) => `Sección pedida: ${m.label}`);
    const payload = { modules: chosen.filter((x) => !x.startsWith("x")), wishes: [...wishes, ...custom], company: company.trim() || undefined };
    if (loggedIn) {
      await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
      window.location.href = "/app";
    } else {
      try { localStorage.setItem(OB_STORAGE, JSON.stringify(payload)); } catch { /* sin almacenamiento: se elige de nuevo después */ }
      window.location.href = "/registro";
    }
  }

  const order = catalog.filter((m) => chosen.includes(m.id));
  const started = msgs.length > 0;

  return (
    <div className="ob">
      <div className="ob-glow" />
      <div className="ob-wrap">
        <header className="ob-top">
          <Wordmark height={24} />
          {loggedIn ? <a href="/app">Ir a mi tablero</a> : <a href="/login">Ya tengo cuenta</a>}
        </header>

        <main className={`ob-stage ${building ? "out" : ""}`}>
          {!started && (
            <section className="ob-hello">
              <div className="ob-orb"><Mark size={64} /></div>
              <h1>¿Qué querés ver de tu empresa?</h1>
              <p>Contanos con tus palabras. Numo arma tu sistema en segundos.</p>
            </section>
          )}

          <div className="ob-chat">
            {msgs.map((m) => m.who === "user" ? (
              <div key={m.id} className="ob-msg user">{m.text}</div>
            ) : (
              <div key={m.id} className="ob-msg bot">
                <div className="ob-av"><Mark size={30} /></div>
                <div>
                  <p>{m.text}{m.typing === "text" && <span className="ob-caret" />}</p>
                  {m.mods && (
                    <div className="ob-mods">
                      {catalog.filter((x) => m.mods!.includes(x.id)).map((x, i) => (
                        <button key={x.id} className={`ob-mod ${chosen.includes(x.id) ? "" : "off"}`} style={{ animationDelay: `${i * 80}ms` }} onClick={() => toggle(x.id)}>
                          <Ico k={x.custom ? "x" : x.id} />{x.label}{x.id !== "dash" && <span className="ob-x">✕</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.ask !== undefined && <p style={{ marginTop: 16 }}>{m.ask}{m.typing === "ask" && <span className="ob-caret" />}</p>}
                  {m.actions && (
                    <div className="ob-actions">
                      <button className="ob-btn go" onClick={build}>Sí, armalo ✦</button>
                      <button className="ob-btn alt" onClick={() => inputRef.current?.focus()}>Agregar algo más</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form className="ob-box" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <textarea ref={inputRef} rows={2} value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={started ? "Ej: también quiero ver el IVA y mandar un reporte a mis socios" : "Ej: quiero ver cuánta plata tengo, controlar lo que me deben y pagar a proveedores a tiempo…"} />
            <div className="ob-row">
              <span>Enter para enviar · Shift + Enter para otra línea</span>
              <button className="ob-send" type="submit" disabled={!q.trim() || busy} aria-label="Enviar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
            </div>
          </form>

          {!started && (
            <div className="ob-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ob-chip" onClick={() => { setQ((v) => (v.trim() ? v.trim() + ", " : "") + s.toLowerCase()); inputRef.current?.focus(); }}>{s}</button>
              ))}
            </div>
          )}
        </main>
      </div>

      {building && (
        <div className="ob-build">
          <ObPreview
            order={order} others={catalog.filter((m) => !m.custom && !chosen.includes(m.id))} company={company} setCompany={setCompany}
            active={active} setActive={setActive}
            onRemove={(id) => { setChosen((c) => c.filter((x) => x !== id)); if (active === id) setActive("dash"); }}
            onAdd={(id) => setChosen((c) => (c.includes(id) ? c : [...c, id]))}
            Ico={Ico} Tile={(p) => <Tile {...p} pv={preview} />} appRef={appRef} preview={preview}
          />
        </div>
      )}

      <div className={`ob-done ${done ? "show" : ""}`}>
        <div><b>Tu Numo está armado.</b><span>Recorrelo, sacá o sumá secciones. {loggedIn ? "Cuando te guste, guardalo." : "Cuando te guste, creá tu cuenta y entrás con esto listo."}</span></div>
        <button className="ob-btn alt" onClick={() => { setBuilding(false); setDone(false); setTimeout(() => inputRef.current?.focus(), 50); }}>← Volver a la charla</button>
        <button className="ob-btn go" onClick={finish} disabled={saving}>{saving ? "Un momento…" : loggedIn ? "Guardar mi Numo →" : "Crear mi cuenta →"}</button>
      </div>
    </div>
  );
}

function Tile({ m, onOpen, pv }: { m: ObModule; onOpen: () => void; pv: DemoPreview }) {
  const T = ({ l, v, c, cl }: { l: string; v: string; c?: string; cl?: string }) => (
    <div onClick={onOpen} className="ob-tile ob-fly ob-click"><div className="l">{l}</div><div className="v">{v}</div>{c && <span className={`c ${cl}`}>{c}</span>}</div>
  );
  const x = pv.extra as Record<string, any>;
  const box = (cls: string, body: React.ReactNode) => <div onClick={onOpen} className={`ob-tile ob-fly ob-click ${cls}`}>{body}</div>;
  switch (m.id) {
    case "dash": return <>{pv.tiles.dash.map(([l, v, c, cl]) => <T key={l} l={l} v={v} c={c} cl={cl} />)}</>;
    case "pyl": return box("w2", <><div className="l">Estado de resultados · {pv.monthName}</div>{(x.pylMini as string[][]).map(([a, b]) => <div key={a} className="ob-rowx"><span>{a}</span><b>{b}</b></div>)}</>);
    case "caja": return box("w2", <><div className="l">Caja proyectada · 13 semanas</div><svg viewBox="0 0 300 90" style={{ width: "100%", height: 96, marginTop: 6 }}><line x1="0" y1="62" x2="300" y2="62" stroke="#B8412C" strokeDasharray="5 4" /><path d="M0,40 C40,55 60,20 100,28 S160,60 190,48 S240,15 270,40 S290,30 300,30" fill="none" stroke="#1F6B45" strokeWidth="3.5" strokeLinecap="round" /></svg></>);
    case "cli": {
      const ag = x.aging as number[]; const tot = ag.reduce((s, v) => s + v, 0) || 1; const cols = ["#2F7D4F", "#EE9F86", "#E0704F", "#C84A30", "#9E2D1D"];
      return box("w2", <><div className="l">Clientes · antigüedad de deuda</div><div className="ob-minibar">{ag.map((v, i) => <i key={i} style={{ flex: Math.max(v / tot, 0.01), background: cols[i] }} />)}</div>{(x.worst as string[][]).map(([n, d]) => <div key={n} className="ob-rowx" style={{ marginTop: 4 }}><span>{n}</span><b style={{ color: "#B8412C" }}>{d}</b></div>)}</>);
    }
    case "fac": return <T l="Facturado este mes" v={x.fac[0]} c={x.fac[1]} cl="g" />;
    case "prov": { const w = x.prov4 as number[]; const mx = Math.max(...w, 1); return box("w2", <><div className="l">A pagar · próximas 4 semanas</div><div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 70, marginTop: 10 }}>{w.map((v, i) => <i key={i} style={{ flex: 1, height: Math.max(4, (v / mx) * 66), background: i ? "#C9D3CC" : "#D9A63E", borderRadius: "6px 6px 0 0", display: "block" }} />)}</div></>); }
    case "iva": return <T l="IVA del mes" v={x.iva[0]} c={x.iva[1]} cl="w" />;
    case "soc": return <T l="Reporte a socios" v="Viernes 17 h" c="listo para revisar" cl="g" />;
    case "ppto": return <T l="Presupuesto" v={x.ppto} c="ventas vs. objetivo" cl="w" />;
    case "stock": return <T l="Stock valorizado" v={x.stock[0]} c={x.stock[1]} cl="w" />;
    case "cap": return box("w2", <><div className="l">Capital de trabajo operativo</div><div className="v">{x.cap[0]}</div><div className="ob-rowx" style={{ marginTop: 6 }}><span>Te deben clientes</span><b>$ {x.cap[1]} M</b></div><div className="ob-rowx"><span>Debés a proveedores</span><b>− $ {x.cap[2]} M</b></div></>);
    case "ciclo": return <T l="Ciclo de la plata" v={x.ciclo[0]} c={x.ciclo[1]} cl="w" />;
    case "eq": return <T l="Punto de equilibrio" v={x.eq[0]} c={x.eq[1]} cl="g" />;
    case "ia": return box("w2", <><div className="l">Asistente</div><div style={{ fontSize: 13, marginTop: 8 }}>“{x.ia[0]}”</div><div style={{ fontSize: 12, color: "#7C8B84", marginTop: 6 }}>{x.ia[1]}</div></>);
    default: return <div onClick={onOpen} className="ob-tile ob-fly ob-click" style={{ borderStyle: "dashed" }}><div className="l">{m.label}</div><div style={{ fontSize: 13, marginTop: 8, color: "#4A5B53" }}>Lo estamos preparando para vos.</div><span className="c w">pedido especial</span></div>;
  }
}
