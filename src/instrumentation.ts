// Se ejecuta una vez al arrancar el servidor: prende el reloj de los reclamos automáticos
// (cada 10 minutos revisa si hay que mandar el aviso del día anterior o los reclamos del día).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
