import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/header";
import BottomNav from "@/components/bottom-nav";
import SWRegister from "@/components/sw-register";
import GlobalSidebar from "@/components/global-sidebar";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CalenTrip",
  description: "Aplicativo de gerenciamento de viagens",
  themeColor: "#007AFF",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0..200"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <SWRegister />
          <Header />
          <GlobalSidebar />
          <div className="pl-14">{children}</div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
