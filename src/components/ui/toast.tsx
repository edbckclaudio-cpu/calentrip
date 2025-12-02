"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type ToastItem = { id: number; message: string; variant?: "info" | "success" | "error"; duration?: number };

const ToastContext = createContext<{
  show: (message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean }) => number;
  dismiss: (id: number) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  function show(message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean }) {
    const id = Date.now() + Math.random();
    const variant = opts?.variant ?? "info";
    const duration = opts?.sticky ? undefined : (opts?.duration ?? 5000);
    setItems((prev) => [...prev, { id, message, variant, duration }]);
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
      <div className="fixed top-2 sm:top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] md:max-w-[560px] lg:max-w-[640px] px-2 space-y-2 flex flex-col items-center">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              `min-w-[240px] max-w-[360px] rounded-lg border px-3 py-2 text-sm shadow-lg ` +
              (t.variant === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : t.variant === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-white border-zinc-200 text-zinc-900 dark:bg-black dark:border-zinc-800 dark:text-zinc-100")
            }
          >
            {t.message}
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
