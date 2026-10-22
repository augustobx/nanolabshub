import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "NanoLabs Hub | Governance", template: "%s | NanoLabs Hub" },
  description: "Centro unificado de gestión de clientes, productos e infraestructura de NanoLabs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`dark ${inter.variable} ${mono.variable}`}>
      <body className="hub-shell flex bg-background font-sans text-slate-100">
        <Sidebar />
        <main id="main-content" className="hub-main flex min-w-0 flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
