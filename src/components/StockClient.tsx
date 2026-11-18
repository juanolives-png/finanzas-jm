"use client";
// Stock: qué hay, cuánto vale (a costo y a precio de venta) y qué está por debajo del mínimo.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Sidebar";

type Item = { id: string; code: string; name: string; kind: string; unit: string | null; category: string | null; stock: number; minimum: number | null; cost: number; price: number };
type Resp = { company: { id: string; name: string; lastSyncAt: string | null }; items: Item[] };
type Filter = "productos" | "bajo" | "sin" | "servicios";

const short = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$ ${(v / 1e6).toFixed(1)} M` : a >= 1e3 ? `$ ${Math.round(v / 1e3)} k` : `$ ${Math.round(v)}`; };
const qty = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

export default function StockClient() {
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(params.get("company"));
  const [d, setD] = useState<Resp | null>(null);
  const [filter, setFilter] = useState<Filter>("productos");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (companyId) return;
    fetch("/api/conexiones/colppy").then((r) => r.json()).then((j) => setCompanyId(j.companies?.[0]?.id ?? ""));
  }, [companyId]);
  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/stock?company=${companyId}`, { cache: "no-store" }).then((r) => r.json()).then(setD);
  }, [companyId]);

  const view = useMemo(() => {
    const items = d?.items ?? [];
    const prods = items.filter((i) => i.kind === "P");
    const low = prods.filter((i) => i.minimum !== null && i.stock <= i.minimum);
    const none = prods.filter((i) => i.stock <= 0);
    const t = q.trim().toLowerCase();
    const list = (filter === "productos" ? prods : filter === "bajo" ? low : filter === "sin" ? none : items.filter((i) => i.kind === "S"))
      .filter((i) => !t || i.name.toLowerCase().includes(t) || i.code.toLowerCase().includes(t))
      .sort((a, b) => b.stock * b.cost - a.stock * a.cost);
    return {
      prods, low, none, list, services: items.filter((i) => i.kind === "S").length,
      atCost: prods.reduce((s, i) => s + Math.max(i.stock, 0) * i.cost, 0),
      atPrice: prods.reduce((s, i) => s + Math.max(i.stock, 0) * i.price, 0),
    };
  }, [d, filter, q]);

  if (!d) return <p className="muted">Cargando…</p>;
  const margin = view.atPrice ? ((view.atPrice - view.atCost) / view.atPrice) * 100 : 0;

  return (
    <>
      <div className="head">
        <div>
          <div className="crumb"><Icon name="bolt" size={13} /> Operaciones</div>
          <h1>Stock</h1>
          <p className="muted small" style={{ marginTop: 4 }}>Ítems de inventario de Colppy con su disponibilidad{d.company.lastSyncAt ? ` · actualizado ${new Date(d.company.lastSyncAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : ""}</p>
        </div>
      </div>

      {d.items.length === 0 ? (
        <div className="card empty">
          <h2>No encontramos ítems de inventario</h2>
          <p>Si cargás tus productos en Colppy (Inventario), acá vas a ver qué tenés, cuánto vale y qué hay que reponer. Tocá “Actualizar ahora” en el Tablero para traerlos.</p>
        </div>
      ) : (
        <>
          <div className="grid kpis">
            <div className="card"><div className="kpi-label">Stock valorizado a costo</div><div className="kpi-value">{short(view.atCost)}</div><div className="kpi-sub muted">{view.prods.length} productos</div></div>
            <div className="card"><div className="kpi-label">A precio de venta</div><div className="kpi-value">{short(view.atPrice)}</div><div className="kpi-sub up">{margin.toFixed(0)}% de margen bruto</div></div>
            <div className="card"><div className="kpi-label">Por debajo del mínimo</div><div className={`kpi-value ${view.low.length ? "down" : ""}`}>{view.low.length}</div><div className="kpi-sub muted">productos para reponer</div></div>
            <div className="card"><div className="kpi-label">Sin stock</div><div className={`kpi-value ${view.none.length ? "down" : ""}`}>{view.none.length}</div><div className="kpi-sub muted">{view.services} servicios aparte</div></div>
          </div>

          <div className="card" style={{ padding: 0, marginTop: 16 }}>
            <div className="toolbar">
              <div className="tabs">
                {([["productos", "Productos"], ["bajo", "Bajo mínimo"], ["sin", "Sin stock"], ["servicios", "Servicios"]] as [Filter, string][]).map(([k, l]) => (
                  <button key={k} className={`tab ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
                ))}
              </div>
              <input placeholder="Buscar producto o código…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Producto</th><th className="num">Disponible</th><th className="num">Mínimo</th><th className="num">Costo</th><th className="num">Precio</th><th className="num">Valor a costo</th></tr></thead>
                <tbody>
                  {view.list.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 24, textAlign: "center" }}>Nada por acá.</td></tr>}
                  {view.list.map((i) => {
                    const low = i.minimum !== null && i.stock <= i.minimum;
                    return (
                      <tr key={i.id} className={low || i.stock <= 0 ? "pending" : ""}>
                        <td><div>{i.name}</div><div className="muted small">{i.code}{i.category ? ` · ${i.category}` : ""}</div></td>
                        <td className={`num ${i.stock <= 0 ? "down" : low ? "" : ""}`}>{qty(i.stock)} {i.unit ?? ""}</td>
                        <td className="num muted">{i.minimum === null ? "—" : qty(i.minimum)}</td>
                        <td className="num">{i.cost ? money(i.cost) : "—"}</td>
                        <td className="num">{i.price ? money(i.price) : "—"}</td>
                        <td className="num">{i.kind === "P" ? money(Math.max(i.stock, 0) * i.cost) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
