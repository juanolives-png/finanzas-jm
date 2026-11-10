"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/nav";

type Props = { user: string; tenant: string; companies: { id: string; name: string }[] };

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6m13 9v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74",
  truck: "M1 4h14v11H1zm14 4h4l3 3v4h-7M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m12 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6m7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2",
};

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function Sidebar({ user, tenant, companies }: Props) {
  const path = usePathname();
  const params = useSearchParams();
  const company = params.get("company") ?? companies[0]?.id ?? "";
  const q = company ? `?company=${company}` : "";
  const [open, setOpen] = useState(false);

  const isOn = (href?: string, slug?: string) => (href ? (href === "/app" ? path === "/app" : path.startsWith(href)) : path === `/app/m/${slug}`);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className={`side ${open ? "open" : ""}`}>
      <div className="side-top">
        <div className="brand">Finanzas <span>JM</span></div>
        <button className="btn-menu" onClick={() => setOpen(!open)} aria-label="Menú">☰</button>
      </div>

      {companies.length > 0 && (
        <select className="company-switch" value={company} onChange={(e) => { window.location.href = `${path}?company=${e.target.value}`; }}>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      <nav className="side-nav">
        {NAV.map((s) => (
          <div className="side-group" key={s.key}>
            <div className="side-title"><Icon name={s.icon} size={14} /> {s.label}</div>
            {s.modules.map((m) => (
              <Link key={m.slug} href={`${m.href ?? `/app/m/${m.slug}`}${q}`} className={`nav ${isOn(m.href, m.slug) ? "on" : ""} ${m.href ? "" : "soon"}`} onClick={() => setOpen(false)}>
                <span>{m.label}</span>
                {!m.href && <span className="pill">pronto</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        <div className="avatar">{user.slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div className="ellipsis">{user}</div>
          <div className="ellipsis muted">{tenant}</div>
        </div>
        <button className="link-btn" onClick={logout}>Salir</button>
      </div>
    </aside>
  );
}
