import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { ERPThemeProvider, ToastProvider } from "@/components/nanolabs";
import { HubShell } from "@/components/HubShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-poppins" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "NanoLabs Hub | Control Central", template: "%s | NanoLabs Hub" },
  description: "Centro unificado de membresías, SaaS, aplicaciones e infraestructura de NanoLabs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="dark" className={`dark ${inter.variable} ${poppins.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <ERPThemeProvider initialTheme="2">
          <ToastProvider>
            <HubShell>{children}</HubShell>
          </ToastProvider>
        </ERPThemeProvider>
      </body>
    </html>
  );
}
