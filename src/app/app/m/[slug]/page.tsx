import { notFound } from "next/navigation";
import { findModule } from "@/lib/nav";
import { Icon } from "@/components/Sidebar";

// Módulos que todavía no están: muestran qué van a hacer.
export default function ModulePage({ params }: { params: { slug: string } }) {
  const m = findModule(params.slug);
  if (!m) notFound();
  return (
    <>
      <div className="head">
        <div>
          <div className="crumb"><Icon name={m.section.icon} size={13} /> {m.section.label}</div>
          <h1>{m.label}</h1>
        </div>
        <span className="badge">En construcción</span>
      </div>
      <div className="card soon-card">
        <p className="lead">{m.desc}</p>
        {m.bullets && (
          <ul className="checks">
            {m.bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
        {m.from && <p className="muted small" style={{ marginTop: 18 }}>Ya funciona en {m.from}: lo estamos trayendo a Finanzas JM.</p>}
      </div>
    </>
  );
}
