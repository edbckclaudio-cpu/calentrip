"use client";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";

export default function SWRegister() {
  const { show } = useToast();
  const showRef = useRef(show);
  useEffect(() => { showRef.current = show; }, [show]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const url = "/sw.js";
    try {
      navigator.serviceWorker.register(url, { scope: "/" }).then((reg) => {
        try { showRef.current("Offline habilitado", { variant: "success" }); } catch {}
        try {
          reg.onupdatefound = () => {
            try { showRef.current("Atualização disponível", { variant: "info" }); } catch {}
          };
        } catch {}
      }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
