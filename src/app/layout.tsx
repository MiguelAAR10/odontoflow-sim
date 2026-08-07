import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OdontoFlow — Estación de recepción",
  description:
    "Confirmación automática de citas para clínicas odontológicas. Demo con datos de prueba.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
