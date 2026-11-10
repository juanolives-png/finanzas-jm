import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Dashboard from "@/components/Dashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AppHome({ searchParams }: { searchParams: { company?: string } }) {
  const s = (await getSession())!;
  const companies = await db.company.findMany({ where: { tenantId: s.tenantId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const companyId = companies.find((c) => c.id === searchParams.company)?.id ?? companies[0]?.id;
  if (!companyId) return <EmptyNoCompany name={s.name} />;
  return <Dashboard companyId={companyId} />;
}

function EmptyNoCompany({ name }: { name: string }) {
  return (
    <>
      <div className="head"><h1>Hola, {name.split(" ")[0]}</h1></div>
      <div className="grid kpis ghost-kpis">
        {["Ingresos del mes", "Gastos del mes", "Resultado", "Caja neta"].map((k) => (
          <div className="card" key={k}><div className="kpi-label">{k}</div><div className="kpi-value">$ —</div></div>
        ))}
      </div>
      <div className="card empty">
        <div className="badge">Paso 1 de 2</div>
        <h2>Conectá tu sistema contable</h2>
        <p>Conectás Colppy una sola vez y Finanzas JM trae tu contabilidad, arma el tablero y lo mantiene actualizado todos los días. Sin cargar nada a mano.</p>
        <Link href="/app/conexiones" className="btn">Conectar mi sistema</Link>
      </div>
    </>
  );
}
