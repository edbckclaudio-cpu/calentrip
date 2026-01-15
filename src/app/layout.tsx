import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/header";
import BottomNav from "@/components/bottom-nav";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.calentrip.digital"),
  title: {
    default: "CalenTrip — Calendário de viagens e alertas",
    template: "%s — CalenTrip",
  },
  description: "Veja voos, hospedagens e atividades em ordem cronológica. Salve no Google Calendar e receba alertas.",
  applicationName: "CalenTrip",
  keywords: ["calendário de viagem", "voos", "hospedagem", "itinerário", "alertas", "Google Calendar"],
  alternates: {
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
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#007AFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Essencial para celulares com notch (Samsung/iPhone)
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
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* SEO e Dados Estruturados - Carregados após a interação para não travar o app */}
        <Script id="calentrip-org-jsonld" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "CalenTrip",
            url: "https://app.calentrip.digital",
            logo: "https://app.calentrip.digital/icon-512.png",
          })}
        </Script>

        <Providers>
          <Header />
          <main 
            className="min-h-screen sm:pb-0" 
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
          >
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}