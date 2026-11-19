"use client";
// ─── Vista previa navegable del Numo que se armó en el inicio ───────────────
// Después de la "explosión", el sistema queda armado y se puede recorrer:
//  · menú de la izquierda: cada sección se abre, se saca (✕) o se suma ("+ Agregar sección")
//  · cada sección explica qué responde, muestra números de ejemplo y deja abrir las filas (así se ve
//    que cada número llega hasta la factura, sin ir a Colppy)
//  · una guía arriba (paso N de M, anterior / siguiente) para recorrerlo en orden
// Todo con números de ejemplo de una distribuidora; nada sale de acá hasta que crea la cuenta.
import { Fragment, useState } from "react";
import { Wordmark } from "@/components/Logo";
import type { ObModule } from "@/lib/onboarding";
import type { DemoPreview } from "@/lib/demoPreview";

type Row = { c: string[]; tone?: "b" | "g" | "w"; detail?: string[][] };
type Info = {
  title: string; lead: string; soon?: boolean;
  kpis: [string, string, string?, ("g" | "b" | "w")?][];
  table?: { cols: string[]; rows: Row[] };
  chart?: boolean;
  tip: string;
  actions: string[];
};

// Textos de cada sección. Los números de ejemplo de acá se reemplazan por los de la empresa demo (demoPreview.ts);
// quedan como respaldo para las secciones que la demo no calcula.
export const OB_INFO: Record<string, Info> = {
  pyl: {
    title: "Estado de resultados", lead: "¿Ganás plata? Del total vendido a lo que te queda, mes a mes.",
    kpis: [["Ventas · octubre", "$ 286,4 M", "▲ 6% vs. sept.", "g"], ["Margen bruto", "40%", "igual que sept.", "w"], ["EBITDA", "$ 41,8 M", "14,6% de ventas", "g"], ["Resultado", "$ 22,3 M", "▲ 9%", "g"]],
    table: { cols: ["Línea", "Octubre", "% ventas"], rows: [
      { c: ["Ventas", "286,4", "100%"], detail: [["Ventas mayoristas", "241,0"], ["Ventas minoristas", "45,4"]] },
      { c: ["Costo de mercadería", "−171,8", "60%"], detail: [["Alimentos Pampa Sur SA", "−58,2"], ["Bebidas del Litoral SRL", "−44,1"], ["Otros 9 proveedores", "−69,5"]] },
      { c: ["Gastos operativos", "−45,9", "16%"], detail: [["Sueldos y cargas depósito", "−14,1"], ["Fletes", "−11,5"], ["Comisiones de vendedores", "−7,2"], ["Servicios", "−8,3"], ["Alquiler depósito", "−4,8"]] },
      { c: ["Estructura", "−26,9", "9%"], detail: [["Sueldos administración", "−20,5"], ["Marketing", "−3,1"], ["Honorarios contables", "−1,9"], ["Software", "−1,4"]] },
      { c: ["EBITDA", "41,8", "14,6%"], tone: "g" },
      { c: ["Impuestos", "−13,9", "4,9%"], detail: [["Ingresos brutos", "−10,0"], ["Débitos y créditos", "−3,9"]] },
      { c: ["Financieros", "−5,6", "2,0%"], detail: [["Intereses del préstamo", "−3,2"], ["Comisiones bancarias", "−2,4"]] },
      { c: ["Resultado", "22,3", "7,8%"], tone: "g" },
    ] },
    tip: "Tocá una línea: ves las cuentas que la forman. En el sistema real seguís hasta el asiento y la factura, sin ir a Colppy.",
    actions: ["Comparar con el mes anterior o el presupuesto", "Ver por sede o centro de costo", "Exportar a Excel", "Marcar un gasto para revisar"],
  },
  caja: {
    title: "Caja y proyección", lead: "¿Cuánta plata tenés hoy, dónde está y si te alcanza para lo que viene.", soon: true,
    kpis: [["Caja hoy", "$ 95,3 M", "3,4 meses de gastos", "g"], ["Entró esta semana", "$ 38,2 M"], ["Salió esta semana", "$ 29,7 M"], ["En 30 días", "$ 71,0 M", "baja por sueldos", "w"]],
    chart: true,
    table: { cols: ["Cuenta", "Saldo hoy"], rows: [
      { c: ["Banco Galicia", "61,8"], detail: [["Cobro · Supermercado La Esquina", "+8,4"], ["Pago · Alimentos Pampa Sur SA", "−12,1"], ["Sueldos", "−20,5"]] },
      { c: ["Banco Nación", "22,4"], detail: [["Cuota del préstamo", "−1,5"], ["Intereses", "−0,9"]] },
      { c: ["Mercado Pago", "10,6"], detail: [["Cobros minoristas de la semana", "+6,2"], ["Pase a Banco Galicia", "−5,0"]] },
      { c: ["Caja", "0,5"] },
    ] },
    tip: "La línea punteada es tu mínimo de caja: la semana que la cruza se ve en rojo antes de que llegue.",
    actions: ["Ver qué entra y sale cada semana", "Simular correr un pago", "Separar transferencias entre tus cuentas", "Exportar el extracto"],
  },
  cli: {
    title: "Clientes y cobranzas", lead: "¿Quién te debe, cuánto y desde cuándo? Y reclamarle sin salir de acá.",
    kpis: [["Te deben", "$ 138,0 M"], ["Vencido", "$ 42,8 M", "31% del total", "b"], ["Atraso promedio", "23 días", "", "w"], ["Clientes con deuda", "17"]],
    table: { cols: ["Cliente", "Saldo", "Atraso"], rows: [
      { c: ["Supermercado La Esquina", "24,7", "12 días"], detail: [["FC-A 0003-00012890 · vence 03/10", "12,1"], ["FC-A 0003-00012913 · vence 17/10", "12,6"]] },
      { c: ["Almacén Don Tito", "18,4", "124 días"], tone: "b", detail: [["FC-A 0003-00012511 · vence 15/07", "6,1"], ["FC-A 0003-00012602 · vence 12/08", "6,0"], ["FC-A 0003-00012688 · vence 09/09", "6,3"]] },
      { c: ["Despensa Mariló", "7,9", "67 días"], tone: "w", detail: [["FC-B 0003-00012655 · vence 01/09", "3,8"], ["FC-B 0003-00012740 · vence 29/09", "4,1"]] },
      { c: ["Bar El Encuentro", "4,2", "97 días"], tone: "b", detail: [["FC-B 0003-00012580 · vence 05/08", "4,2"]] },
    ] },
    tip: "Tocá un cliente: ves cada factura que te debe. Desde ahí le mandás el reclamo, con un tono distinto según el atraso.",
    actions: ["Mandar el reclamo por mail", "Adjuntar las facturas en PDF", "Ver en cuántos días te paga de verdad", "Anotar un acuerdo de pago"],
  },
  fac: {
    title: "Facturación", lead: "Lo que facturaste, a quién y cuánto falta cobrar.", soon: true,
    kpis: [["Facturado este mes", "$ 98 M", "42 facturas", "g"], ["Ticket promedio", "$ 2,3 M"], ["Sin cobrar", "$ 61 M", "", "w"]],
    table: { cols: ["Cliente", "Facturado", "Facturas"], rows: [
      { c: ["Supermercado La Esquina", "21,4", "3"], detail: [["FC-A 0003-00012913", "12,6"], ["FC-A 0003-00012935", "8,8"]] },
      { c: ["Autoservicio El Trébol", "16,9", "3"] }, { c: ["Súper Familia", "15,1", "3"] },
    ] },
    tip: "Cada factura se abre con su PDF. Emitir facturas desde Numo llega más adelante.",
    actions: ["Ver las facturas sin cobrar", "Abrir el PDF de cada factura", "Exportar el libro de ventas"],
  },
  prov: {
    title: "Proveedores y pagos", lead: "¿A quién le debés y qué tenés que pagar esta semana?",
    kpis: [["Debés", "$ 71,3 M"], ["Vence esta semana", "$ 14,9 M", "", "w"], ["Vencido", "$ 3,1 M", "", "b"], ["Proveedores", "11"]],
    table: { cols: ["Proveedor", "Saldo", "Vence"], rows: [
      { c: ["Alimentos Pampa Sur SA", "22,8", "jueves"], tone: "w", detail: [["FC-A 0002-00004177 · vence jueves", "9,7"], ["FC-A 0002-00004205 · vence en 12 días", "13,1"]] },
      { c: ["Bebidas del Litoral SRL", "17,5", "en 9 días"], detail: [["FC-A 0003-00004198 · vence en 9 días", "17,5"]] },
      { c: ["Golosinas Aurora SA", "3,1", "vencida"], tone: "b", detail: [["FC-A 0005-00004156 · venció hace 6 días", "3,1"]] },
    ] },
    tip: "Tocá un proveedor y ves cada factura. Armás la tanda de pagos y le mandás el aviso de pago por mail.",
    actions: ["Armar los pagos de la semana", "Mandar el aviso de pago", "Reclamar una nota de crédito", "Ver en qué se va la plata"],
  },
  iva: {
    title: "IVA e impuestos", lead: "Cuánto IVA vas a pagar este mes, antes de que llegue el vencimiento.", soon: true,
    kpis: [["IVA débito", "$ 60,1 M"], ["IVA crédito", "− $ 52,7 M"], ["A pagar", "$ 7,4 M", "vence el 18", "w"]],
    table: { cols: ["Concepto", "Noviembre"], rows: [
      { c: ["Débito por ventas", "60,1"], detail: [["Facturas A", "50,6"], ["Facturas B", "9,5"]] },
      { c: ["Crédito por compras", "−52,7"], detail: [["Mercadería", "−44,9"], ["Gastos y servicios", "−7,8"]] },
      { c: ["Saldo a pagar", "7,4"], tone: "w" },
    ] },
    tip: "Ves el IVA del mes mientras pasa, no cuando lo liquida el contador.",
    actions: ["Ver los vencimientos del mes", "Comparar con el mes anterior"],
  },
  soc: {
    title: "Reporte a socios", lead: "Todos los viernes a las 17, el resumen de la semana en el mail de tus socios.", soon: true,
    kpis: [["Cobrado", "$ 38,2 M", "▲ 12% vs. semana anterior", "g"], ["Pagado", "$ 29,7 M"], ["Caja hoy", "$ 95,3 M"], ["Vencido de clientes", "$ 42,8 M", "", "b"]],
    table: { cols: ["Top deudores", "Saldo", "Atraso"], rows: [
      { c: ["Supermercado La Esquina", "24,7", "12 días"] }, { c: ["Almacén Don Tito", "18,4", "124 días"], tone: "b" }, { c: ["Despensa Mariló", "7,9", "67 días"], tone: "w" },
    ] },
    tip: "Cada número del mail es un link que abre Numo justo en ese detalle.",
    actions: ["Elegir a quién le llega", "Cambiar el día y la hora", "Mandarlo ahora"],
  },
  ppto: {
    title: "Presupuesto y objetivos", lead: "¿Vas bien contra lo que planeaste? Cada desvío, con su explicación.", soon: true,
    kpis: [["Ventas vs. objetivo", "98%", "", "w"], ["EBITDA vs. objetivo", "104%", "", "g"], ["Gastos vs. objetivo", "101%", "", "w"]],
    table: { cols: ["Línea", "Objetivo", "Real", "Desvío"], rows: [
      { c: ["Ventas", "292,0", "286,4", "−2%"], tone: "w", detail: [["Ventas mayoristas", "−4,1"], ["Ventas minoristas", "−1,5"]] },
      { c: ["Gastos operativos", "−45,0", "−45,9", "+2%"], tone: "w", detail: [["Fletes (más viajes)", "+1,3"], ["Servicios", "−0,4"]] },
      { c: ["EBITDA", "40,2", "41,8", "+4%"], tone: "g" },
    ] },
    tip: "El presupuesto se arma copiando el año anterior con un % de ajuste, o subiendo un Excel.",
    actions: ["Cargar el presupuesto desde Excel", "Ver el desvío por cuenta", "Ajustar el objetivo"],
  },
  ia: {
    title: "Asistente con IA", lead: "Preguntale a tus números con tus palabras.", soon: true,
    kpis: [],
    table: { cols: ["Preguntaste", "Numo responde"], rows: [
      { c: ["¿Por qué bajó el margen en julio?", "Subieron los fletes 18% y hubo 2 facturas de agosto cargadas en julio."] },
      { c: ["¿Qué cliente me conviene menos?", "Almacén Don Tito: te compra el 5% pero paga a 124 días."] },
      { c: ["¿Me alcanza para el aguinaldo?", "Sí, con $ 9 M de margen si cobrás lo que vence esta semana."] },
    ] },
    tip: "Cada respuesta trae el link al detalle de donde sale.",
    actions: ["Preguntar algo", "Ver de dónde sale la respuesta"],
  },
  stock: {
    title: "Stock e inventario", lead: "Qué tenés, cuánto vale y qué hay que reponer.",
    kpis: [["Stock valorizado", "$ 54 M", "a costo"], ["Bajo mínimo", "7 productos", "", "w"], ["Sin stock", "2 productos", "", "b"], ["Margen promedio", "27%", "", "g"]],
    table: { cols: ["Producto", "Stock", "Mínimo"], rows: [
      { c: ["Leche larga vida 1 L", "0", "30"], tone: "b" }, { c: ["Cerveza lata 473 ml", "8", "20"], tone: "w" },
      { c: ["Arroz largo fino 1 kg", "24", "40"], tone: "w" }, { c: ["Aceite de girasol 1,5 L", "48", "20"] },
    ] },
    tip: "Ordenado por lo que más plata tenés inmovilizada. Lo que falta, arriba.",
    actions: ["Ver lo que hay que reponer", "Ver el margen de cada producto", "Exportar a Excel"],
  },
  cap: {
    title: "Capital de trabajo", lead: "Cuánta plata tenés atada en la calle: lo que te deben menos lo que debés.",
    kpis: [["Capital de trabajo", "$ 66,7 M"], ["Te deben", "$ 138,0 M"], ["Debés", "− $ 71,3 M"]],
    table: { cols: ["Componente", "Hoy"], rows: [
      { c: ["Te deben clientes", "138,0"], detail: [["Por vencer", "95,2"], ["Vencido", "42,8"]] },
      { c: ["Debés a proveedores", "−71,3"], detail: [["Vence este mes", "−48,0"], ["Más adelante", "−23,3"]] },
      { c: ["Capital de trabajo", "66,7"], tone: "w" },
    ] },
    tip: "Si cobrás lo vencido, liberás $ 42,8 M: más que un mes de sueldos y alquiler.",
    actions: ["Ver quién te debe", "Ver a quién le debés"],
  },
  ciclo: {
    title: "Ciclo de la plata", lead: "En cuántos días te pagan de verdad, y en cuántos pagás vos.", soon: true,
    kpis: [["Cobrás a", "41 días", "pactado 30", "w"], ["Pagás a", "33 días"], ["Ciclo", "8 días", "lo financiás vos", "w"]],
    table: { cols: ["Cliente", "Pactado", "Real"], rows: [
      { c: ["Proveeduría San José", "30 días", "30 días"], tone: "g" }, { c: ["Supermercado La Esquina", "30 días", "42 días"], tone: "w" },
      { c: ["Almacén Don Tito", "30 días", "158 días"], tone: "b" },
    ] },
    tip: "Con este dato negociás: el que paga tarde, compra con anticipo o con otro precio.",
    actions: ["Ver el detalle por cliente", "Mandar el resumen de cuenta"],
  },
  eq: {
    title: "Punto de equilibrio", lead: "Cuánto tenés que vender para no perder plata.", soon: true,
    kpis: [["Punto de equilibrio", "$ 214 M"], ["Ventas de octubre", "$ 286 M"], ["Margen de seguridad", "34%", "", "g"]],
    table: { cols: ["Cálculo", "Octubre"], rows: [
      { c: ["Costos fijos del mes", "85,6"], detail: [["Sueldos", "34,6"], ["Alquiler y servicios", "13,1"], ["Estructura", "6,4"], ["Impuestos y financieros", "31,5"]] },
      { c: ["Margen de contribución", "40%"] }, { c: ["Equilibrio = fijos ÷ margen", "214"], tone: "w" },
    ] },
    tip: "Si sube un costo fijo, ves al instante cuánto más tenés que vender.",
    actions: ["Simular un aumento de sueldos", "Simular un cambio de precios"],
  },
};

type Props = {
  order: ObModule[]; others: ObModule[]; company: string;
  active: string; setActive: (id: string) => void;
  onRemove: (id: string) => void; onAdd: (id: string) => void; setCompany: (s: string) => void;
  Ico: (p: { k: string }) => JSX.Element; Tile: (p: { m: ObModule; onOpen: () => void }) => JSX.Element;
  appRef: React.RefObject<HTMLDivElement>;
  preview: DemoPreview;
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

export default function ObPreview({ order, others, company, active, setActive, onRemove, onAdd, setCompany, Ico, Tile, appRef, preview }: Props) {
  const [adding, setAdding] = useState(false);
  const steps = [...order.map((m) => m.id), "conectar"];
  const idx = Math.max(0, steps.indexOf(active));
  const cur = order.find((m) => m.id === active);
  const go = (d: number) => setActive(steps[Math.min(steps.length - 1, Math.max(0, idx + d))]);

  return (
    <div className="ob-app" ref={appRef}>
      <aside className="ob-side">
        <div className="ob-brand"><Wordmark height={20} /></div>
        <div className="ob-t ob-fly">{company.trim() || "Tu empresa"}</div>
        {order.map((m) => (
          <div key={m.id} className={`ob-nav ob-fly ${active === m.id ? "on" : ""}`} role="button" tabIndex={0} onClick={() => setActive(m.id)} onKeyDown={(e) => e.key === "Enter" && setActive(m.id)}>
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
        <div className={`ob-nav ob-fly ${active === "conectar" ? "on" : ""}`} role="button" tabIndex={0} onClick={() => setActive("conectar")}><Ico k="x" /><span className="ob-nav-l">Conectar sistemas</span></div>
      </aside>

      <main className="ob-main">
        <div className="ob-guide ob-fly">
          <span className="ob-step">Paso {idx + 1} de {steps.length}</span>
          <span className="ob-guide-t">{idx === 0 ? "Recorré tu Numo: tocá las secciones o seguí con las flechas." : active === "conectar" ? "Último paso: conectar tu sistema." : "Tocá las filas para ver de dónde sale cada número."}</span>
          <span className="ob-arrows">
            <button onClick={() => go(-1)} disabled={idx === 0} aria-label="Anterior">←</button>
            <button onClick={() => go(1)} disabled={idx === steps.length - 1} aria-label="Siguiente">→</button>
          </span>
        </div>

        {active === "dash" ? (
          <>
            <h2 className="ob-fly ob-hi">Buen día, <input className="ob-name" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="tu empresa" aria-label="Nombre de tu empresa" maxLength={60} /></h2>
            <div className="ob-sub ob-fly">Así se va a ver tu empresa. Por ahora con los números de {preview.company}, nuestra empresa de ejemplo: la vas a tener adentro para seguir recorriéndola. Tocá una tarjeta para abrir su sección.</div>
            <div className="ob-tiles">{order.map((m) => <Tile key={m.id} m={m} onOpen={() => m.id !== "dash" && setActive(m.id)} />)}</div>
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
          <Page key={cur.id} info={infoFor(cur.id, preview)!} />
        ) : null}
      </main>
    </div>
  );
}

function Page({ info }: { info: Info }) {
  const [open, setOpen] = useState<number | null>(info.table?.rows.findIndex((r) => r.detail) ?? null);
  return (
    <div className="ob-page">
      <h2>{info.title} {info.soon && <span className="ob-soon">Llega pronto</span>}</h2>
      <div className="ob-sub">{info.lead}</div>
      {info.kpis.length > 0 && (
        <div className="ob-tiles">
          {info.kpis.map(([l, v, c, cl]) => <div className="ob-tile" key={l}><div className="l">{l}</div><div className="v">{v}</div>{c && <span className={`c ${cl ?? "g"}`}>{c}</span>}</div>)}
        </div>
      )}
      {info.chart && (
        <div className="ob-card">
          <div className="l">Caja proyectada · 13 semanas</div>
          <svg viewBox="0 0 300 90" style={{ width: "100%", height: 90 }}><line x1="0" y1="62" x2="300" y2="62" stroke="#B8412C" strokeDasharray="5 4" /><path d="M0,40 C40,55 60,20 100,28 S160,60 190,48 S240,15 270,40 S290,30 300,30" fill="none" stroke="#1F6B45" strokeWidth="3.5" strokeLinecap="round" /></svg>
        </div>
      )}
      {info.table && (
        <div className="ob-card ob-tbl">
          <table>
            <thead><tr>{info.table.cols.map((c, i) => <th key={c} className={i ? "n" : ""}>{c}</th>)}</tr></thead>
            <tbody>
              {info.table.rows.map((r, i) => (
                <Fragment key={i}>
                  <tr className={`${r.detail ? "can" : ""} ${open === i ? "open" : ""} ${r.tone ? "t-" + r.tone : ""}`} onClick={() => r.detail && setOpen(open === i ? null : i)}>
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
