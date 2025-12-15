import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/header";
import BottomNav from "@/components/bottom-nav";
import SWRegister from "@/components/sw-register";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://calentrip.digital"),
  title: {
    default: "CalenTrip — Calendário de viagens e alertas",
    template: "%s — CalenTrip",
  },
  description: "Veja voos, hospedagens e atividades em ordem cronológica. Salve no Google Calendar e receba alertas.",
  applicationName: "CalenTrip",
  keywords: [
    "calendário de viagem",
    "voos",
    "hospedagem",
    "itinerário",
    "alertas",
    "Google Calendar",
  ],
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
    languages: {
      "pt-BR": "/",
      en: "/?lang=en",
      es: "/?lang=es",
    },
  },
  openGraph: {
    type: "website",
    siteName: "CalenTrip",
    title: "CalenTrip — Calendário de viagens e alertas",
    description: "Planeje e acompanhe voos, hospedagens e atividades com notificações.",
    url: "/",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "CalenTrip" }],
    locale: "pt_BR",
  },
  twitter: {
    card: "summary",
    title: "CalenTrip",
    description: "Calendário de viagens com alertas e integração com Google Calendar",
    images: ["/icon-512.png"],
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#007AFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0..200&display=swap"
        />
        <link rel="icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "CalenTrip",
          url: (process.env.NEXT_PUBLIC_SITE_URL || "https://calentrip.digital"),
          logo: "/icon-512.png"
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "CalenTrip",
          url: (process.env.NEXT_PUBLIC_SITE_URL || "https://calentrip.digital"),
          potentialAction: {
            "@type": "SearchAction",
            target: (process.env.NEXT_PUBLIC_SITE_URL || "https://calentrip.digital") + "/flights/search?query={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }) }} />
        <Providers>
          <SWRegister />
          <Header />
          <div className="sm:pb-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}>{children}</div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
