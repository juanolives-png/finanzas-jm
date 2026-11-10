import { Suspense } from "react";
import DeudaClient from "@/components/DeudaClient";

export default function Page() {
  return <Suspense fallback={<p className="muted">Cargando…</p>}><DeudaClient kind="clientes" /></Suspense>;
}
