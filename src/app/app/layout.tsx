import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const tenant = await db.tenant.findUnique({ where: { id: s.tenantId }, select: { name: true } });
  const companies = await db.company.findMany({ where: { tenantId: s.tenantId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  return (
    <div className="shell">
      <Suspense><Sidebar user={s.name} tenant={tenant?.name ?? ""} companies={companies} /></Suspense>
      <main className="main">{children}</main>
    </div>
  );
}
