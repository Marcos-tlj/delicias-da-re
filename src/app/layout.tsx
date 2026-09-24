import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { CartProvider } from "@/lib/cart";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: "Delícias da Rê — Bolos, doces e tortas",
  description: "Faça seu pedido de bolos, doces e tortas da Delícias da Rê.",
  appleWebApp: { capable: true, title: "Delícias da Rê", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4b2e20",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <CartProvider>
          <div className="mx-auto min-h-dvh max-w-md bg-cream shadow-[0_0_40px_rgba(75,46,32,0.08)]">
            {children}
          </div>
          <BottomNav />
        </CartProvider>
      </body>
    </html>
  );
}
