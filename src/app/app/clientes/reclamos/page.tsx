import { Suspense } from "react";
import ReclamosClient from "@/components/ReclamosClient";

export default function Page() {
  return <Suspense fallback={<p className="muted">Cargando…</p>}><ReclamosClient /></Suspense>;
}
