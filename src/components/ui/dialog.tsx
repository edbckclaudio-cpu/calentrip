"use client";
import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Dialog({ open, onOpenChange, children, placement = "center", disableBackdropClose = false }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode; placement?: "center" | "bottom" | "left"; disableBackdropClose?: boolean }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setEntered(true), 0);
    return () => clearTimeout(id);
  }, [open, placement]);
  if (!open) return null;

  const container = (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/40" onClick={() => { if (!disableBackdropClose) onOpenChange(false); }} />
      {placement === "left" ? (
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute top-0 bottom-0 left-0 z-[1000] w-64 max-w-[80vw] rounded-r-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-black overflow-y-auto ${entered ? "" : "transform -translate-x-full transition-transform duration-300 ease-out"}`}
        >
          {children}
        </div>
      ) : placement === "bottom" ? (
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute bottom-0 left-0 right-0 z-[1000] w-full rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-black max-h-[85vh] overflow-y-auto ${entered ? "" : "transform translate-y-full transition-transform duration-300 ease-out"}`}
        >
          {children}
        </div>
      ) : (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="relative z-[1000] w-full max-w-md rounded-lg bg-white p-4 shadow-lg dark:bg-black border border-zinc-200 dark:border-zinc-800 max-h-[85vh] overflow-y-auto">
            {children}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(container, document.body);
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-lg font-semibold">{children}</div>;
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}
