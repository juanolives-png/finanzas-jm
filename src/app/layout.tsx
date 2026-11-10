import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finanzas JM",
  description: "Tu CFO automático: tablero, cashflow y reporte a socios conectados a tu sistema contable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
