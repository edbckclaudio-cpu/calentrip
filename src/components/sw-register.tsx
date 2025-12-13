"use client";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";

export default function SWRegister() {
  const { t } = useI18n();
  const { show } = useToast();
  const showRef = useRef(show);
  useEffect(() => { showRef.current = show; }, [show]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const url = "/sw.js";
    try {
      navigator.serviceWorker.register(url, { scope: "/" }).then((reg) => {
        try {
          reg.onupdatefound = () => {
            try { showRef.current(t("updateAvailableMsg"), { variant: "info", key: "updateAvailableMsg" }); } catch {}
          };
        } catch {}
      }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
