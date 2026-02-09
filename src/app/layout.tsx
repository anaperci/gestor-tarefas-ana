import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Hub - Gestor de Tarefas",
  description: "Gestor de tarefas com autenticação e roles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
