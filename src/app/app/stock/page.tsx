import { Suspense } from "react";
import StockClient from "@/components/StockClient";

export default function Page() {
  return <Suspense fallback={<p className="muted">Cargando…</p>}><StockClient /></Suspense>;
}
