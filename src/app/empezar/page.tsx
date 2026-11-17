import { getSession } from "@/lib/auth";
import Onboarding from "@/components/Onboarding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Numo · Armá tu sistema" };

// Puerta de entrada: "¿Qué querés ver de tu empresa?". Es pública: el anuncio de Instagram puede traer acá.
export default async function Empezar() {
  const s = await getSession();
  return <Onboarding loggedIn={!!s} />;
}
