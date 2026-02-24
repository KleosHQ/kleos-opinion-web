import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import ClientProviders from "./ClientProviders";
import { BottomBarWrapper } from "@/components/BottomBarWrapper";
import "./globals.css";
import { ViewTransitions } from "next-view-transitions";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const ntBrickSans = localFont({
  src: "../font/NTBrickSans/NTBrickSans.ttf",
  variable: "--font-ntbrick",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kleos | Opinion Markets",
  description: "On-chain opinion market protocol",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ViewTransitions>
    <html lang="en" className={`dark ${inter.variable} ${ntBrickSans.variable}`}>
      <body className="bg-background text-foreground antialiased font-sans">
        <ClientProviders>
          {children}
          <BottomBarWrapper />
        </ClientProviders>
      </body>
    </html>
    </ViewTransitions>
  );
}
