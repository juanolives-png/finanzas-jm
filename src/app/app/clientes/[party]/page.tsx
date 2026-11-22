import { Suspense } from "react";
import FichaClient from "@/components/FichaClient";

export default function Page({ params }: { params: { party: string } }) {
  return <Suspense fallback={<p className="muted">Cargando…</p>}><FichaClient party={decodeURIComponent(params.party)} /></Suspense>;
}
