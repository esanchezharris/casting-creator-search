import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BOOT } from "@/lib/view-boot";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Casting — creator search",
  description: "Search a creator roster in plain language and preview profiles without clicking through.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      {/* The saved theme and card size are applied before the first paint. */}
      <head><script dangerouslySetInnerHTML={{ __html: BOOT }} /></head>
      <body>
        {/* One tooltip opens after a short wait; its neighbours then open at once. */}
        <TooltipProvider delay={400}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
