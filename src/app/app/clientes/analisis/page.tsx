import { Suspense } from "react";
import CarteraClient from "@/components/CarteraClient";

export default function Page() {
  return <Suspense fallback={<p className="muted">Cargando…</p>}><CarteraClient /></Suspense>;
}
