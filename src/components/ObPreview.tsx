"use client";
// ─── Vista previa navegable del Numo que se armó en el inicio ───────────────
// Después de la "explosión", el sistema queda armado y se puede recorrer:
//  · menú de la izquierda: cada sección se abre, se saca (✕) o se suma ("+ Agregar sección")
//  · cada sección explica qué responde, muestra números de ejemplo y deja abrir las filas (así se ve
//    que cada número llega hasta la factura, sin ir a Colppy)
//  · una guía arriba (paso N de M, anterior / siguiente) para recorrerlo en orden
// Todo con números de ejemplo de una distribuidora; nada sale de acá hasta que crea la cuenta.
import { Fragment, useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/Logo";
import type { ObModule } from "@/lib/onboarding";
import type { DemoPreview } from "@/lib/demoPreview";
import { OB_INFO, type Info } from "@/lib/obInfo";
export { OB_INFO };


type Props = {
  order: ObModule[]; others: ObModule[]; company: string;
  active: string; setActive: (id: string) => void;
  onRemove: (id: string) => void; onAdd: (id: string) => void; setCompany: (s: string) => void;
  Ico: (p: { k: string }) => JSX.Element; Tile: (p: { m: ObModule; onOpen: () => void }) => JSX.Element;
  appRef: React.RefObject<HTMLDivElement>;
  preview: DemoPreview;
  rubro?: string | null;
};

/** Textos fijos de cada sección + números de la empresa demo (los mismos que se ven adentro). */
function infoFor(id: string, p: DemoPreview): Info | null {
  const base = OB_INFO[id];
  if (!base) return null;
  const s = p.sections[id];
  if (id === "ia" && base.table) {
    const ia = p.extra.ia as string[];
    return { ...base, table: { ...base.table, rows: [{ c: ia }, ...base.table.rows.slice(1)] } };
  }
  if (!s) return base;
  return { ...base, kpis: s.kpis, table: s.rows && s.cols ? { cols: s.cols, rows: s.rows } : base.table, tip: s.tip ?? base.tip };
}

export default function ObPreview({ order, others, company, active, setActive, onRemove, onAdd, setCompany, Ico, Tile, appRef, preview, rubro }: Props) {
  const [adding, setAdding] = useState(false);
  const steps = [...order.map((m) => m.id), "conectar"];
  const idx = Math.max(0, steps.indexOf(active));
  const cur = order.find((m) => m.id === active);
  const go = (d: number) => setActive(steps[Math.min(steps.length - 1, Math.max(0, idx + d))]);

  // Hallazgos: primero los de las secciones que eligió; si faltan, otros (al tocarlos se suma la sección)
  const chosenIds = new Set(order.map((m) => m.id));
  const insights = [...preview.insights.filter((x) => chosenIds.has(x.module)), ...preview.insights.filter((x) => !chosenIds.has(x.module))].slice(0, 3);
  const [focus, setFocus] = useState<{ module: string; row?: number } | null>(null);
  const openInsight = (x: (typeof insights)[number]) => { if (!chosenIds.has(x.module)) onAdd(x.module); setFocus({ module: x.module, row: x.row }); setActive(x.module); };
  const nav = (id: string) => { setFocus(null); setActive(id); };

  return (
    <div className="ob-app" ref={appRef}>
      <aside className="ob-side">
        <div className="ob-brand"><Wordmark height={20} /></div>
        <div className="ob-t ob-fly">{company.trim() || "Tu empresa"}</div>
        {order.map((m) => (
          <div key={m.id} className={`ob-nav ob-fly ${active === m.id ? "on" : ""}`} role="button" tabIndex={0} onClick={() => nav(m.id)} onKeyDown={(e) => e.key === "Enter" && nav(m.id)}>
            <Ico k={m.custom ? "x" : m.id} /><span className="ob-nav-l">{m.id === "dash" ? "Inicio" : m.label}</span>
            {m.id !== "dash" && <button className="ob-rm" title="Sacar esta sección" onClick={(e) => { e.stopPropagation(); onRemove(m.id); }}>✕</button>}
          </div>
        ))}
        {others.length > 0 && (
          <div className="ob-add ob-fly">
            <button className="ob-add-btn" onClick={() => setAdding((a) => !a)}>{adding ? "Listo" : "+ Agregar sección"}</button>
            {adding && others.map((m) => (
              <button key={m.id} className="ob-add-opt" onClick={() => { onAdd(m.id); setActive(m.id); }}><Ico k={m.id} />{m.label}</button>
            ))}
          </div>
        )}
        <div className="ob-t ob-fly">Configuración</div>
        <div className={`ob-nav ob-fly ${active === "conectar" ? "on" : ""}`} role="button" tabIndex={0} onClick={() => nav("conectar")}><Ico k="x" /><span className="ob-nav-l">Conectar sistemas</span></div>
      </aside>

      <main className="ob-main">
        <div className="ob-guide ob-fly">
          <span className="ob-step">Paso {idx + 1} de {steps.length}</span>
          <span className="ob-guide-t">{idx === 0 ? "Recorré tu Numo: tocá las secciones o seguí con las flechas." : active === "conectar" ? "Último paso: conectar tu sistema." : "Tocá las filas para ver de dónde sale cada número."}</span>
          <span className="ob-arrows">
            <button onClick={() => { setFocus(null); go(-1); }} disabled={idx === 0} aria-label="Anterior">←</button>
            <button onClick={() => { setFocus(null); go(1); }} disabled={idx === steps.length - 1} aria-label="Siguiente">→</button>
          </span>
        </div>

        {active === "dash" ? (
          <>
            <h2 className="ob-fly ob-hi">Buen día, <input className="ob-name" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="tu empresa" aria-label="Nombre de tu empresa" maxLength={60} /></h2>
            <div className="ob-sub ob-fly">Así se va a ver tu {rubro ? rubro.toLowerCase() : "empresa"}. Por ahora con los números de {preview.company}, nuestra empresa de ejemplo: la vas a tener adentro para seguir recorriéndola. Cuando conectes Colppy, son los tuyos.</div>
            <div className="ob-found ob-fly">
              <div className="ob-found-h"><span className="ob-dot" /> Numo encontró {insights.length} cosas en tus números</div>
              <div className="ob-found-g">
                {insights.map((x, i) => (
                  <button key={x.module} className="ob-ins" style={{ animationDelay: `${1.6 + i * 0.35}s` }} onClick={() => openInsight(x)}>
                    <span className="big"><Num v={x.big} delay={1600 + i * 350} /></span>
                    <span className="t">{x.title}</span>
                    <span className="x">{x.text}</span>
                    <span className="go">Ver de dónde sale →</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="ob-tiles">{order.map((m) => <Tile key={m.id} m={m} onOpen={() => m.id !== "dash" && nav(m.id)} />)}</div>
          </>
        ) : active === "conectar" ? (
          <Connect />
        ) : cur?.custom ? (
          <div className="ob-page">
            <h2>{cur.label}</h2>
            <div className="ob-sub">Esto lo pediste vos y todavía no es una sección de Numo.</div>
            <div className="ob-card"><p>Lo anotamos con tus palabras. Cuando crees tu cuenta, lo vemos juntos y te decimos cómo lo resolvemos: como una sección nueva o dentro de una que ya existe.</p></div>
          </div>
        ) : cur && infoFor(cur.id, preview) ? (
          <Page key={cur.id + (focus?.module === cur.id ? "f" : "")} info={infoFor(cur.id, preview)!} cash={preview.cash} focus={focus?.module === cur.id ? focus.row : undefined} />
        ) : null}
      </main>
    </div>
  );
}

function Page({ info, cash, focus }: { info: Info; cash: DemoPreview["cash"]; focus?: number }) {
  const [open, setOpen] = useState<number | null>(focus ?? info.table?.rows.findIndex((r) => r.detail) ?? null);
  return (
    <div className="ob-page">
      <h2>{info.title} {info.soon && <span className="ob-soon">Llega pronto</span>}</h2>
      <div className="ob-sub">{info.lead}</div>
      {info.kpis.length > 0 && (
        <div className="ob-tiles">
          {info.kpis.map(([l, v, c, cl]) => <div className="ob-tile" key={l}><div className="l">{l}</div><div className="v"><Num v={v} /></div>{c && <span className={`c ${cl ?? "g"}`}>{c}</span>}</div>)}
        </div>
      )}
      {info.chart && (
        <div className="ob-card">
          <div className="l">Caja proyectada · 13 semanas (la línea roja es un mes de gastos fijos)</div>
          <CashChart cash={cash} height={110} />
        </div>
      )}
      {info.table && (
        <div className="ob-card ob-tbl">
          <table>
            <thead><tr>{info.table.cols.map((c, i) => <th key={c} className={i ? "n" : ""}>{c}</th>)}</tr></thead>
            <tbody>
              {info.table.rows.map((r, i) => (
                <Fragment key={i}>
                  <tr className={`${r.detail ? "can" : ""} ${open === i ? "open" : ""} ${r.tone ? "t-" + r.tone : ""} ${focus === i ? "pulse" : ""}`} onClick={() => r.detail && setOpen(open === i ? null : i)}>
                    {r.c.map((x, j) => <td key={j} className={j ? "n" : ""}>{j === 0 && r.detail && <span className="ob-car">{open === i ? "▾" : "▸"}</span>}{x}</td>)}
                  </tr>
                  {open === i && r.detail?.map((d, k) => (
                    <tr key={k} className="sub"><td>{d[0]}</td><td className="n">{d[1]}</td>{r.c.length > 2 && <td colSpan={r.c.length - 2} />}</tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="ob-tip"><b>Cómo se usa.</b> {info.tip}</div>
      <div className="ob-can">
        <div className="l">Qué podés hacer acá</div>
        <div>{info.actions.map((a) => <span key={a}>{a}</span>)}</div>
      </div>
    </div>
  );
}

function Connect() {
  return (
    <div className="ob-page">
      <h2>Conectar sistemas</h2>
      <div className="ob-sub">Tres pasos y estos números pasan a ser los tuyos.</div>
      <div className="ob-card">
        <ol className="ob-steps">
          <li><b>Creás tu cuenta.</b> Entrás con tu Numo ya armado como lo dejaste, y con {"Distribuidora del Sol"} para seguir mirando.</li>
          <li><b>Conectás Colppy</b> con tu usuario. Numo solo lee: nunca modifica nada en tu Colppy.</li>
          <li><b>En unos minutos</b> trae tu último año y medio de contabilidad y se actualiza solo todos los días.</li>
        </ol>
      </div>
      <div className="ob-can"><div className="l">Próximamente</div><div><span>Mercado Pago</span><span>Bancos</span><span>ARCA</span><span>Xubio</span></div></div>
    </div>
  );
}

/** Número que sube desde cero (respeta "$ 192,4 M", "38%", "43 días"…). */
export function Num({ v, delay = 0 }: { v: string; delay?: number }) {
  const m = v.match(/-?[\d.]+(?:,\d+)?/);
  const [txt, setTxt] = useState(m ? v.replace(m[0], "0") : v);
  useEffect(() => {
    if (!m) { setTxt(v); return; }
    const raw = m[0], dec = raw.includes(",") ? raw.split(",")[1].length : 0;
    const target = Number(raw.replace(/\./g, "").replace(",", "."));
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setTxt(v); return; }
    let raf = 0; const t0 = performance.now() + delay, dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
      setTxt(v.replace(raw, (target * e).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{txt}</>;
}

/** Caja proyectada con los datos de la demo: la línea se dibuja sola y marca el punto más bajo. */
export function CashChart({ cash, height = 96 }: { cash: DemoPreview["cash"]; height?: number }) {
  const W = 300, H = 90, pad = 8;
  const all = [...cash.weeks, cash.min, 0];
  const lo = Math.min(...all), hi = Math.max(...all);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (cash.weeks.length - 1);
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const d = cash.weeks.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const p = ref.current; if (!p) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.3,.7,.2,1) .3s"; p.style.strokeDashoffset = "0";
  }, [d]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height, marginTop: 6 }} role="img" aria-label="Caja proyectada a 13 semanas">
      <line x1={pad} y1={y(cash.min)} x2={W - pad} y2={y(cash.min)} stroke="#B8412C" strokeDasharray="5 4" strokeWidth="1.2" />
      <path d={`${d} L${x(cash.weeks.length - 1)},${H - pad} L${x(0)},${H - pad} Z`} fill="#1F6B45" opacity=".08" />
      <path ref={ref} d={d} fill="none" stroke="#1F6B45" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(cash.lowWeek)} cy={y(cash.low)} r="4" fill="#D9A63E" className="ob-lowdot" />
    </svg>
  );
}
