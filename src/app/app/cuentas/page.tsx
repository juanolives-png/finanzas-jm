import { Suspense } from "react";
import CuentasClient from "@/components/CuentasClient";

export default function Cuentas() {
  return <Suspense fallback={<p className="muted">Cargando…</p>}><CuentasClient /></Suspense>;
}
