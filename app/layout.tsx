import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import RegistrarServiceWorker from "@/components/RegistrarServiceWorker";

// Serifada usada só em títulos e valores de destaque (ver --font-serif em globals.css) —
// dá identidade de "livro/missal" à marca sem afetar a legibilidade da UI no dia a dia.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PDV | Sistema de Vendas e Estoque",
  description: "Sistema de ponto de venda e gerenciamento de estoque",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sistema PDV",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#163C30",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full antialiased ${fraunces.variable}`}>
      <body className="min-h-full flex flex-col">
        <RegistrarServiceWorker />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
