"use client";
import { ReactNode, useEffect } from "react";
import { TripProvider } from "@/lib/trip-context";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    function ensureVisible() {
      try {
        const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
        if (!isMobile) return;
        const el = document.querySelector<HTMLElement>(".animate-pulse");
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 0;
        if (r.top < 0 || r.bottom > vh || r.top < 64) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch {}
    }
    ensureVisible();
    const mo = new MutationObserver(() => ensureVisible());
    try { mo.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ["class"] }); } catch {}
    const onResize = () => ensureVisible();
    const onFocusIn = () => ensureVisible();
    window.addEventListener("resize", onResize);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      try { mo.disconnect(); } catch {}
      window.removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);
  useEffect(() => {
    try {
      const key = "calentrip:firstLoadReloaded";
      const already = typeof window !== "undefined" ? localStorage.getItem(key) === "1" : false;
      const check = async () => {
        try {
          const fontsObj = typeof document !== "undefined" ? (document as unknown as { fonts?: { ready: Promise<void>; check?: (font: string) => boolean } }).fonts : undefined;
          const fontsReady = fontsObj ? await Promise.race([
            fontsObj.ready.then(() => true),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
          ]) : true;
          const symbolsOk = fontsObj?.check ? fontsObj.check("12px 'Material Symbols Outlined'") : true;
          if ((!fontsReady || !symbolsOk) && !already) {
            try { localStorage.setItem(key, "1"); } catch {}
            try { window.location.reload(); } catch {}
          } else {
            try { localStorage.removeItem(key); } catch {}
          }
        } catch {}
      };
      check();
    } catch {}
  }, []);
  return (
    <SessionProvider basePath="/api/auth" refetchInterval={0} refetchOnWindowFocus={false}>
      <I18nProvider>
        <TripProvider>
          <ToastProvider>{children}</ToastProvider>
        </TripProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
