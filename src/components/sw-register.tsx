"use client";
import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const url = "/sw.js";
    try {
      navigator.serviceWorker.register(url, { scope: "/" }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
