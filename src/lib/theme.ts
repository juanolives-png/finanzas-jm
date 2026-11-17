"use client";
// Tema claro / oscuro / automático. Se guarda en el navegador de cada usuario.
import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "auto";
const KEY = "numo-theme";

/** Script que corre antes de pintar la página, así no hay parpadeo al cargar. */
export const THEME_INIT = `(function(){try{var p=localStorage.getItem("${KEY}")||"light";var d=p==="dark"||(p==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export function applyTheme(p: ThemePref) {
  const dark = p === "dark" || (p === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  try { localStorage.setItem(KEY, p); } catch { /* sin almacenamiento: igual se aplica */ }
}

export function readThemePref(): ThemePref {
  try { return (localStorage.getItem(KEY) as ThemePref) || "light"; } catch { return "light"; }
}

/** Color de una variable CSS del tema actual (para los gráficos). */
export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Cambia cada vez que cambia el tema: los gráficos lo usan para redibujarse con los colores nuevos. */
export function useThemeKey() {
  const [k, setK] = useState(0);
  useEffect(() => {
    const o = new MutationObserver(() => setK((x) => x + 1));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onOs = () => { if (readThemePref() === "auto") applyTheme("auto"); };
    mq.addEventListener("change", onOs);
    return () => { o.disconnect(); mq.removeEventListener("change", onOs); };
  }, []);
  return k;
}
