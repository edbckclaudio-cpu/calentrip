"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type ToastItem = { id: number; message: string; variant?: "info" | "success" | "error"; duration?: number };

const ToastContext = createContext<{ show: (message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number }) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  function show(message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number }) {
    const id = Date.now() + Math.random();
    const variant = opts?.variant ?? "info";
    const duration = opts?.duration ?? 5000;
    setItems((prev) => [...prev, { id, message, variant, duration }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
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
