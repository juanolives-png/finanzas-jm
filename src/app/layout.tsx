import "./globals.css";
import type { Metadata } from "next";
import { THEME_INIT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Numo",
  description: "Numo mira los números para que vos mires tu negocio. Tablero, caja y deuda de clientes al día, conectado a tu sistema contable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
