import type { Metadata } from "next";
import { Hanken_Grotesk, Marcellus } from "next/font/google";
import "./globals.css";

// Design System "Clareza": Hanken Grotesk (interface) + Marcellus (display/marca)
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
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
      <body className={`${hanken.variable} ${marcellus.variable}`}>
        {children}
      </body>
    </html>
  );
}
