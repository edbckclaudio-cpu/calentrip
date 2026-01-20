"use client";
import { ReactNode, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { TripProvider } from "@/lib/trip-context";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/toast";
import { NativeAuthProvider } from "@/lib/native-auth";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => { try { window.clearTimeout(id); } catch {} };
  }, []);
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
  }, []);
  if (!mounted) return null;
  const isAndroid = typeof window !== "undefined" && Capacitor.getPlatform() === "android";
  const content = (
    <NativeAuthProvider>
      <I18nProvider>
        <TripProvider>
          <ToastProvider>{children}</ToastProvider>
        </TripProvider>
      </I18nProvider>
    </NativeAuthProvider>
  );
  if (isAndroid) {
    return (
      <SessionProvider session={null} refetchOnWindowFocus={false} refetchWhenOffline={false} refetchInterval={0}>
        {content}
      </SessionProvider>
    );
  }
  return <SessionProvider>{content}</SessionProvider>;
}
