import { getSession } from "@/lib/auth";
import Onboarding from "@/components/Onboarding";
import { demoPreview } from "@/lib/demoPreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Numo · Armá tu sistema" };

// Puerta de entrada: "¿Qué querés ver de tu empresa?". Es pública: el anuncio de Instagram puede traer acá.
export default async function Empezar() {
  const s = await getSession();
  // Los números del recorrido salen de la empresa demo: lo que ve acá es lo mismo que ve adentro
  return <Onboarding loggedIn={!!s} preview={demoPreview()} />;
}
