import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Sin sesión, la raíz lleva al inicio mágico ("¿Qué querés ver de tu empresa?").
export default async function Home() {
  redirect((await getSession()) ? "/app" : "/empezar");
}
