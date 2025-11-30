"use client";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

export default function SWRegister() {
  const { show } = useToast();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const url = "/sw.js";
    try {
      navigator.serviceWorker.register(url, { scope: "/" }).then((reg) => {
        try { show("Offline habilitado", { variant: "success" }); } catch {}
        try {
          reg.onupdatefound = () => {
            try { show("Atualização disponível", { variant: "info" }); } catch {}
          };
        } catch {}
      }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
