import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const head = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-head", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Delícias da Rê", template: "%s · Delícias da Rê" },
  description: "Pedidos, estoque, preços e lucro da Delícias da Rê",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Delícias da Rê", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#241a28",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${head.variable}`}>
      <body className="font-sans text-[15px] antialiased lg:text-sm">{children}</body>
    </html>
  );
}
