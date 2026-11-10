import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Por ahora la raíz manda al sistema o al login. Más adelante acá va la landing.
export default async function Home() {
  redirect((await getSession()) ? "/app" : "/login");
}
