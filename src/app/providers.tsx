"use client";
import { ReactNode, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
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
      if (process.env.NEXT_PUBLIC_ENABLE_SW === "1") return;
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator)) return;
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) { try { r.unregister(); } catch {} }
      }).catch(() => {});
    } catch {}
  }, []);
  useEffect(() => {
    (async () => {
      try {
        if (Capacitor.getPlatform() !== "android") return;
        const { Purchases } = await import("@revenuecat/purchases-capacitor");
        await Purchases.configure({ apiKey: "goog_PbcDTYZKuoIjsfDSNyFYqfSxGIg" });
      } catch {}
    })();
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
