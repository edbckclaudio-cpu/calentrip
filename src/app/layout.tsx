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

const SITE_URL = "/";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.calentrip.digital"),
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
        <Script id="disable-sqlite" strategy="beforeInteractive">{`try{window.db_disabled=true;}catch{}`}</Script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0..200&display=swap"
        />
        <link rel="icon" sizes="192x192" href="file:///android_asset/public/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="file:///android_asset/public/icon-192.png" />
        <Script id="fix-paths" strategy="beforeInteractive">
          {`
          (function(){
            function fix(el, attr){
              try{
                var v=el.getAttribute(attr); if(!v) return;
                v=v.replace(/^https?:\\/\\/(?:localhost|app\\.calentrip\\.digital)\\/\\_?next\\//,'file:///android_asset/public/_next/');
                v=v.replace(/^\\/\\_?next\\//,'file:///android_asset/public/_next/');
                v=v.replace(/^_next\\//,'file:///android_asset/public/_next/');
                v=v.replace(/^https?:\\/\\/(?:localhost|app\\.calentrip\\.digital)\\/(icon-192\\.png|icon-512\\.png|icon\\.svg|favicon\\.ico)$/,'file:///android_asset/public/$1');
                v=v.replace(/^\\/(icon-192\\.png|icon-512\\.png|icon\\.svg|favicon\\.ico)$/,'file:///android_asset/public/$1');
                v=v.replace(/^(icon-192\\.png|icon-512\\.png|icon\\.svg|favicon\\.ico)$/,'file:///android_asset/public/$1');
                if(v!==el.getAttribute(attr)) el.setAttribute(attr,v);
              }catch{}
            }
            function run(){
              try{
                var els=document.querySelectorAll('link[href],script[src],img[src]');
                els.forEach(function(el){fix(el,el.tagName==='LINK'?'href':'src')});
              }catch{}
            }
            try{
              run();
              document.addEventListener('DOMContentLoaded',run);
              var obs=new MutationObserver(function(ms){
                try{
                  ms.forEach(function(m){
                    (m.addedNodes||[]).forEach(function(n){
                      if(n && n.nodeType===1){
                        var el=n;
                        if(el.tagName==='LINK' && el.href) fix(el,'href');
                        if(el.tagName==='SCRIPT' && el.src) fix(el,'src');
                        if(el.tagName==='IMG' && el.src) fix(el,'src');
                        var q=el.querySelectorAll && el.querySelectorAll('link[href],script[src],img[src]');
                        if(q && q.length) q.forEach(function(e){fix(e,e.tagName==='LINK'?'href':'src')});
                      }
                    });
                  });
                }catch{}
              });
              obs.observe(document.documentElement,{childList:true,subtree:true});
            }catch{}
          })();
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="calentrip-org-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "CalenTrip",
            url: "/",
            logo: "/icon-512.png",
          })}
        </Script>
        <Script id="calentrip-website-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "CalenTrip",
            url: "/",
            potentialAction: {
              "@type": "SearchAction",
              target: "/flights/search?query={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          })}
        </Script>
        <Providers>
          <Header />
          <div className="sm:pb-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}>{children}</div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
