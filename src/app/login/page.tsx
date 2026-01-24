"use client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { t } = useI18n();
  const { status } = useSession();
  const [loadingProvider, setLoadingProvider] = useState<"google" | null>(null);
  const redirected = useRef(false);
  const router = useRouter();
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
    if (status === "authenticated" && !redirected.current) {
      redirected.current = true;
      try { router.push(callbackUrl); } catch {}
    }
  }, [status, callbackUrl, router]);

  return (
    <div className="container-page py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-md p-1 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700" onClick={() => { try { router.push("/flights/search"); } catch {} }}>
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
        <h1 className="text-2xl font-semibold text-[var(--brand)]">{t("loginUnlockTitle")}</h1>
      </div>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{t("loginUnlockText")}</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={async () => {
            try {
              setLoadingProvider("google");
              await signIn("google", { callbackUrl, redirect: true });
            } catch {
              setLoadingProvider(null);
              try { alert("Login com Google indisponível no momento."); } catch {}
            }
          }}
          disabled={loadingProvider !== null}
        >
          {t("signInWithGoogle")}
        </Button>
      </div>
    </div>
  );
}
