import type { Metadata } from "next";
import { Poppins, Marcellus } from "next/font/google";
import "./globals.css";

// Design System "Clareza": Poppins (sans-serif geométrica, interface) + Marcellus (display/marca)
const sans = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const marcellus = Marcellus({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-marcellus",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clareza — Gestor de Tarefas",
  description: "Foco com clareza. Plataforma colaborativa de gestão de projetos e tarefas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${marcellus.variable}`}>
        {children}
      </body>
    </html>
  );
}
