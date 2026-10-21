import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import { direction } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { ArabicUiTranslator } from "@/components/layout/arabic-ui-translator";
import { ServiceWorkerCleanup } from "@/components/layout/service-worker-cleanup";
import { OfflineSyncBanner } from "@/components/layout/offline-sync-banner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: "Fließend Deutsch Academy",
  description: "Academy management system for Fließend Deutsch",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getCurrentLanguage();
  return (
    <html lang={lang} dir={direction(lang)}>
      <body className={`${inter.variable} ${cairo.variable} min-h-screen font-sans antialiased ${lang === "ar" ? "font-cairo" : ""}`}><ServiceWorkerCleanup /><ArabicUiTranslator lang={lang} /><OfflineSyncBanner />{children}</body>
    </html>
  );
}
