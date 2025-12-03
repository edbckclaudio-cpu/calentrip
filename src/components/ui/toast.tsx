"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type ToastItem = { id: number; message: string; variant?: "info" | "success" | "error"; duration?: number; key?: string };

const ToastContext = createContext<{
  show: (message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean; key?: string }) => number;
  dismiss: (id: number) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  function show(message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean; key?: string }) {
    const id = Date.now() + Math.random();
    const variant = opts?.variant ?? "info";
    const duration = opts?.sticky ? undefined : (opts?.duration ?? 5000);
    const k = opts?.key;
    setItems((prev) => {
      const cleared = k ? prev.filter((t) => t.key !== k) : [];
      return [...cleared, { id, message, variant, duration, key: k }];
    });
    if (typeof duration === "number") {
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }

  function dismiss(id: number) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed top-0 left-0 right-0 z-[9999] w-full px-2 pt-2 sm:pt-3 space-y-2 flex flex-col items-center pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              `relative min-w-[220px] max-w-[90vw] sm:max-w-[560px] lg:max-w-[640px] rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[12px] sm:text-sm leading-snug break-words shadow-lg pointer-events-auto ` +
              (t.variant === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : t.variant === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-white border-zinc-200 text-zinc-900 dark:bg-black dark:border-zinc-800 dark:text-zinc-100")
            }
          >
            {t.message}
            {((typeof t.duration !== "number") || (t.message || "").length > 80) ? (
              <button
                type="button"
                className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => dismiss(t.id)}
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider ausente");
  return ctx;
}
