"use client";
import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ToastItem = { id: number; message: string; variant?: "info" | "success" | "error"; duration?: number; key?: string; minimized?: boolean };

const ToastContext = createContext<{
  show: (message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean; key?: string }) => number;
  dismiss: (id: number) => void;
  minimize: (id: number) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const [vvTop, setVvTop] = useState(0);
  const [vvLeft, setVvLeft] = useState(0);
  const canPortal = typeof document !== "undefined";
  useEffect(() => {
    try {
      const vv = (typeof window !== "undefined" ? window.visualViewport : null);
      const update = () => {
        const top = vv ? Math.round(vv.offsetTop) : 0;
        const left = vv ? Math.round(vv.offsetLeft) : 0;
        setVvTop(top);
        setVvLeft(left);
      };
      update();
      vv?.addEventListener("scroll", update);
      vv?.addEventListener("resize", update);
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      return () => {
        vv?.removeEventListener("scroll", update);
        vv?.removeEventListener("resize", update);
        window.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
      };
    } catch {}
  }, []);

  function show(message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean; key?: string }) {
    idRef.current = (idRef.current + 1) || 1;
    const id = idRef.current;
    const variant = opts?.variant ?? "info";
    const duration = opts?.sticky ? undefined : (opts?.duration ?? 13000);
    const k = opts?.key;
    setItems((prev) => {
      const cleared = k ? prev.filter((t) => t.key !== k) : [];
      return [...cleared, { id, message, variant, duration, key: k, minimized: false }];
    });
    if (typeof duration === "number") {
      setTimeout(() => {
        minimize(id);
      }, duration);
    }
    return id;
  }

  function dismiss(id: number) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  function toggleMinimize(id: number) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, minimized: !t.minimized } : t)));
  }
  function minimize(id: number) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, minimized: true } : t)));
  }

  const portal = (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] w-full px-2 space-y-2 flex flex-col items-center"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)", marginTop: vvTop, marginLeft: vvLeft }}
      suppressHydrationWarning
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={
            (t.minimized
              ? `relative min-w-[160px] max-w-[92vw] rounded-xl px-2 py-1 text-[12px] font-semibold leading-snug shadow-2xl ring-2 pointer-events-auto `
              : `relative min-w-[220px] max-w-[92vw] sm:max-w-[560px] lg:max-w-[640px] rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-[14px] sm:text-sm font-semibold leading-snug break-words shadow-2xl ring-2 pointer-events-auto `) +
            (t.variant === "success"
              ? "bg-emerald-600 text-white ring-emerald-700"
              : t.variant === "error"
              ? "bg-red-600 text-white ring-red-700"
              : "bg-[#007AFF] text-white ring-[#005bbb]")
          }
        >
          {t.minimized ? (
            <div className="flex items-center gap-2 pr-8">
              <span className="line-clamp-1">{(t.message || "").slice(0, 32)}{(t.message || "").length > 32 ? "…" : ""}</span>
            </div>
          ) : (
            <div className="pr-8">{t.message}</div>
          )}
          <button
            type="button"
            className="absolute top-1 right-8 sm:top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md/2 bg-white/10 hover:bg-white/20 text-white"
            onClick={() => toggleMinimize(t.id)}
            aria-label={t.minimized ? "Maximizar" : "Minimizar"}
          >
            <span className="material-symbols-outlined text-[18px]">{t.minimized ? "expand_more" : "expand_less"}</span>
          </button>
          <button
            type="button"
            className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md/2 bg-white/10 hover:bg-white/20 text-white"
            onClick={() => dismiss(t.id)}
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={{ show, dismiss, minimize }}>
      {children}
      {canPortal ? createPortal(portal, document.body) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider ausente");
  return ctx;
}
