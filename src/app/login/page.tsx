"use client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { useMemo } from "react";

export default function LoginPage() {
  const { t } = useI18n();
  const nextParam = useMemo(() => {
    try {
      if (typeof window === "undefined") return null;
      const sp = new URLSearchParams(window.location.search);
      return sp.get("callback") || sp.get("next") || null;
    } catch { return null; }
  }, []);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const safe = (url: string | null) => {
    if (!url) return null;
    try { const u = new URL(url, origin); return u.origin === origin ? u.toString() : null; } catch { return null; }
  };
  const ref = typeof document !== "undefined" ? document.referrer : "";
  const fallback = safe(ref) || (origin ? origin + "/flights/search" : "/flights/search");
  const callbackUrl = safe(nextParam) || fallback;

  return (
    <div className="container-page py-6 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--brand)]">{t("loginUnlockTitle")}</h1>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{t("loginUnlockText")}</p>
      <div className="flex items-center gap-2">
        <Button type="button" onClick={() => signIn("google", { callbackUrl })}>{t("signInWithGoogle")}</Button>
        <Button type="button" variant="secondary" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl })}>{t("signInDemo")}</Button>
      </div>
    </div>
  );
}
