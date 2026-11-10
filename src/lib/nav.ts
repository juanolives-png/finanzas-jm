// Mapa del sistema: secciones del menú y módulos. Los que todavía no están muestran qué van a tener
// (sirve para que el cliente vea hacia dónde va el producto, y para vos como hoja de ruta).

export type Module = {
  slug: string;
  label: string;
  href?: string; // si existe, el módulo ya funciona
  desc: string;
  bullets?: string[];
  from?: string; // de qué sistema sale
};
export type Section = { key: string; label: string; icon: string; modules: Module[] };

export const NAV: Section[] = [
  {
    key: "inicio", label: "Inicio", icon: "home",
    modules: [{ slug: "tablero", label: "Tablero", href: "/app", desc: "Ingresos, EBITDA, resultado y caja de un vistazo." }],
  },
  {
    key: "finanzas", label: "Finanzas", icon: "chart",
    modules: [
      { slug: "resultados", label: "Estado de resultados", desc: "P&L mes a mes por categoría y por cuenta, con el detalle de cada asiento.", bullets: ["Contribución, EBITDA y resultado", "Abrir cualquier celda y ver a quién se le pagó", "Por centro de costo / sede"], from: "Huerta" },
      { slug: "cashflow", label: "Cashflow", desc: "Lo que entró y salió de cada banco, y la proyección de los próximos 90 días.", bullets: ["Saldo por banco y caja", "Proyección con vencimientos de clientes y proveedores", "Cheques en cartera"], from: "Huerta + Infocampo" },
      { slug: "iva", label: "IVA e impuestos", desc: "IVA débito vs. crédito, posición del mes y proyección.", bullets: ["Posición de IVA mensual", "IIBB y percepciones", "Calendario de vencimientos"], from: "Huerta" },
      { slug: "cierre", label: "Cierre de mes", desc: "El mes cerrado en una página: operativo vs. financiero.", from: "Huerta" },
    ],
  },
  {
    key: "clientes", label: "Clientes", icon: "users",
    modules: [
      { slug: "deuda-clientes", label: "Deuda y reclamos", href: "/app/clientes", desc: "Quién te debe, cuánto y desde cuándo; reclamos por mail con tono según el atraso." },
      { slug: "cobranzas", label: "Reclamo masivo", desc: "Mandar el resumen de cuenta a todos los clientes vencidos de una vez.", bullets: ["Elegís tramo (+30, +60, +90)", "Un mail por cliente con su tono", "Resumen de lo enviado"], from: "Infocampo" },
      { slug: "facturacion", label: "Facturación", desc: "Facturar a Colppy desde el sistema (módulo premium).", from: "Infocampo" },
    ],
  },
  {
    key: "proveedores", label: "Proveedores", icon: "truck",
    modules: [
      { slug: "deuda-proveedores", label: "Deuda y pagos", href: "/app/proveedores", desc: "Lo que debés y cuándo vence; órdenes de pago y reclamos a proveedores por mail." },
      { slug: "pagos", label: "Pagos realizados", desc: "Qué salió de cada banco, agrupado por proveedor, impuestos, sueldos y bancos.", from: "Infocampo" },
    ],
  },
  {
    key: "operaciones", label: "Operaciones", icon: "bolt",
    modules: [
      { slug: "reporte-socios", label: "Reporte a socios", desc: "Todos los viernes a las 17, el mail con cómo viene el negocio.", bullets: ["Cobrado, pagado y flujo de la semana", "Top deudores", "Comparación con la semana anterior"], from: "Infocampo" },
      { slug: "presupuesto", label: "Presupuesto", desc: "Objetivos por mes y real vs. presupuesto.", from: "Huerta" },
      { slug: "asistente", label: "Asistente CFO", desc: "Preguntale a tus números: “¿por qué bajó el resultado en julio?”", from: "Huerta" },
    ],
  },
  {
    key: "config", label: "Configuración", icon: "gear",
    modules: [
      { slug: "cuentas", label: "Plan de cuentas", href: "/app/cuentas", desc: "Cómo se agrupa cada cuenta en el resultado." },
      { slug: "conexiones", label: "Conectar sistemas", href: "/app/conexiones", desc: "Colppy, Mercado Pago, bancos, ARCA." },
      { slug: "correo", label: "Correo y cobros", href: "/app/config/correo", desc: "Casilla de envío, firma y datos para transferir." },
      { slug: "usuarios", label: "Usuarios", desc: "Invitá a tus socios, contador o equipo, con permisos por rol." },
    ],
  },
];

export const findModule = (slug: string) => NAV.flatMap((s) => s.modules.map((m) => ({ ...m, section: s }))).find((m) => m.slug === slug);
