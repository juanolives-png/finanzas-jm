// Textos de cada sección del recorrido del inicio (qué responde, cómo se usa, qué se puede hacer).
// Los números de ejemplo se reemplazan por los de la empresa demo (demoPreview.ts). Lo usa también el chat con IA.

export type Row = { c: string[]; tone?: "b" | "g" | "w"; detail?: string[][] };
export type Info = {
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
  ret: {
    title: "Retención y churn", lead: "Quién compra, quién dejó de comprar y quién está por irse.",
    kpis: [],
    tip: "Tocá un cliente para ver cuándo compró por última vez y cada cuánto compraba.",
    actions: ["Llamar a los que están en riesgo", "Ver los clientes perdidos del año", "Elegir cuántos días sin comprar es \"perdido\"", "Ver la concentración de ventas"],
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
