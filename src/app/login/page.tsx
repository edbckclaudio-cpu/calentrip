"use client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

export default function LoginPage() {
  const { t } = useI18n();
  const { status } = useSession();
  const [loadingProvider, setLoadingProvider] = useState<"google" | "demo" | null>(null);
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
  const fallback = origin ? origin + "/profile" : "/profile";
  const callbackUrl = safe(nextParam) || fallback;

  useEffect(() => {
    if (status === "authenticated") {
      try { window.location.href = callbackUrl; } catch {}
    }
  }, [status, callbackUrl]);

  return (
    <div className="container-page py-6 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--brand)]">{t("loginUnlockTitle")}</h1>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{t("loginUnlockText")}</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => { setLoadingProvider("google"); signIn("google", { callbackUrl, redirect: true }); }}
          disabled={loadingProvider !== null}
        >
          {t("signInWithGoogle")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => { setLoadingProvider("demo"); signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl, redirect: true }); }}
          disabled={loadingProvider !== null}
        >
          {t("signInDemo")}
        </Button>
      </div>
    </div>
  );
}
