import type { Metadata } from "next";
import { Figtree, Poppins } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ordum — Gestor de Tarefas",
  description: "Plataforma colaborativa de gestão de projetos e tarefas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${figtree.variable} ${poppins.variable}`}>
        {children}
      </body>
    </html>
  );
}
