"use client";
import { useSession, signOut } from "next-auth/react";
import { getTrips, TripItem } from "@/lib/trips-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isTripPremium } from "@/lib/premium";
import { useToast } from "@/components/ui/toast";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Capacitor } from "@capacitor/core";
import { useNativeAuth } from "@/lib/native-auth";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { user: nativeUser, status: nativeStatus, loginWithGoogle, logout } = useNativeAuth();
  const [googleLogged, setGoogleLogged] = useState(false);
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [premiumUntil, setPremiumUntil] = useState("");
  const { show } = useToast();
  const { t } = useI18n();
  const [priceLabel, setPriceLabel] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const router = useRouter();

  // Memoiza as viagens e o status premium
  const currentTrip = useMemo(() => trips.length ? trips[0] : null, [trips]);
  
  // Verifica se o premium está ativo (seja por viagem ou global)
  const isPremiumActive = useMemo(() => {
    if (premiumUntil) return true;
    return currentTrip ? isTripPremium(currentTrip.id) : false;
  }, [currentTrip, premiumUntil]);

  // Função para checar o status da assinatura no localStorage
  const checkPremiumStatus = useCallback(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:premium") : null;
      if (!raw) {
        setPremiumUntil("");
        return;
      }
      const list: Array<{ tripId: string; expiresAt: number }> = JSON.parse(raw);
      const rec = list.find((r) => r.tripId === "global" && r.expiresAt > Date.now());
      
      if (rec) {
        const d = new Date(rec.expiresAt);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        setPremiumUntil(`${dd}/${mm}`);
      } else {
        setPremiumUntil("");
      }
    } catch {
      setPremiumUntil("");
    }
  }, []);

  useEffect(() => {
    setTrips(getTrips());
    checkPremiumStatus();

    // Listener para atualizar o selo instantaneamente se houver mudança no storage
    window.addEventListener("storage", checkPremiumStatus);
    return () => window.removeEventListener("storage", checkPremiumStatus);
  }, [checkPremiumStatus]);

  useEffect(() => {
    (async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          setGoogleLogged(nativeStatus === "authenticated");
        } else {
          setGoogleLogged(status === "authenticated");
        }
        const mod = await import("@/lib/billing");
        const info = await mod.ensureProduct(process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "trip_premium");
        if (info?.price) setPriceLabel(info.price);
      } catch {}
    })();
  }, [status, nativeStatus]);

  async function handleGoogleLogin() {
    try {
      if (isSigning) return;
      setIsSigning(true);
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        try { await loginWithGoogle(); setGoogleLogged(true); } catch (error) { console.error("Erro no Login:", error); }
      } else {
        router.push("/login?next=/profile");
      }
    } catch (error) {
      console.error("Erro no Login:", error);
    } finally {
      setIsSigning(false);
    }
  }

  const userDisplayName = Capacitor.isNativePlatform() 
    ? (nativeUser?.name || nativeUser?.email || "Usuário") 
    : (session?.user?.name || session?.user?.email || "Usuário");

  const userEmail = Capacitor.isNativePlatform() 
    ? (nativeUser?.email || "") 
    : (session?.user?.email || "");

  return (
    <div className="min-h-screen px-4 py-6 space-y-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="container-page flex items-center gap-3">
        <button 
          type="button" 
          className="rounded-md p-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" 
          onClick={() => router.push("/flights/search")}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">{t("profileTitle")}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("profileSubtitleMonthly")}</p>
        </div>
      </div>

      <div className="container-page flex justify-center">
        <Button
          type="button"
          className="h-12 w-full max-w-xs bg-[var(--brand)] text-white font-semibold rounded-xl shadow-lg hover:brightness-95 transition-all"
          onClick={() => router.push("/")}
        >
          Ir para Tela Inicial
        </Button>
      </div>

      <div className="container-page grid gap-4 md:grid-cols-2">
        {/* Card de Conta com o novo Badge */}
        <Card className="rounded-2xl shadow-sm border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Capacitor.isNativePlatform() ? googleLogged : status === "authenticated") ? (
              <div className="flex flex-col items-center sm:items-start sm:flex-row gap-4">
                <div className="relative">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xl font-bold shadow-inner">
                    {userDisplayName.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <div className={(isPremiumActive ? "bg-amber-500 text-white" : "bg-zinc-200 text-zinc-600") + " inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase shadow-sm"}>
                      {isPremiumActive ? "Assinante Premium" : "Conta Gratuita"}
                    </div>
                  </div>
                </div>
                
                <div className="text-center sm:text-left pt-1">
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">{userDisplayName}</div>
                  <div className="text-xs text-zinc-500 mb-3">{userEmail}</div>
                  
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => router.push("/subscription/checkout/")}>
                      Pagamento
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={async () => {
                      Capacitor.isNativePlatform() ? (await logout(), setGoogleLogged(false)) : await signOut();
                    }}>
                      Sair
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-6 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                <div className="text-base font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Entre para sincronizar</div>
                <Button
                  type="button"
                  className="w-full h-11 rounded-xl bg-white text-black border border-zinc-300 hover:bg-zinc-50 flex items-center justify-center gap-2 shadow-sm"
                  disabled={isSigning}
                  onClick={() => handleGoogleLogin()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 31.9 29.3 35 24 35c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.4l5.7-5.7C33.7 3.2 29.1 1 24 1 16.3 1 9.6 5.3 6.3 11.7z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.3 16.3 18.8 13 24 13c3.3 0 6.3 1.2 8.6 3.4l5.7-5.7C33.7 3.2 29.1 1 24 1 16.3 1 9.6 5.3 6.3 11.7z"/>
                    <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.9 36.6 27.1 37.7 24 37.7c-5.3 0-9.8-3.3-11.4-7.9l-6.4 5C9.6 42.7 16.3 47 24 47z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.7 3.9-5.7 6.7-11.3 6.7-5.3 0-9.8-3.3-11.4-7.9l-6.4 5C9.6 42.7 16.3 47 24 47c12.1 0 21-9.8 21-21 0-1.7-.2-3.3-.4-4.5z"/>
                  </svg>
                  Entrar com Google
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de Assinatura */}
        <Card className="rounded-2xl shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("subscriptionMonthlyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {currentTrip ? (
              <div className="space-y-4">
                <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg space-y-1">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{t("currentTripLabel")}: {currentTrip.title}</div>
                  <div className="text-xs text-zinc-500">{currentTrip.date}</div>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-400">{t("statusLabel")}</span>
                  <span className={`font-bold ${isPremiumActive ? "text-amber-600" : "text-zinc-400"}`}>
                    {isPremiumActive ? `${t("activeStatus")}${premiumUntil ? ` (${t("untilWord")} ${premiumUntil})` : ""}` : t("inactiveStatus")}
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="text-xs text-zinc-500 leading-relaxed">{t("subMonthlyText")}</div>
                  
                  {!isPremiumActive ? (
                    <Button
                      type="button"
                      className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-200 dark:shadow-none transition-all"
                      disabled={purchasing}
                      onClick={async () => {
                        try {
                          setPurchasing(true);
                          const mod = await import("@/lib/billing");
                          const userId = session?.user?.email || session?.user?.name || undefined;
                          const r = await mod.completePurchaseForTrip("global", userId);
                          if (r?.ok) {
                            show(t("purchaseSuccess"), { variant: "success" });
                            router.push("/subscription/success");
                          } else {
                            const err = (r as { error?: string })?.error;
                            const msg = err === "billing" ? "Disponível no app Android via Google Play." : t("purchaseFail");
                            show(msg, { variant: "error" });
                          }
                        } catch { show(t("purchaseError"), { variant: "error" }); }
                        finally { setPurchasing(false); }
                      }}
                    >
                      {priceLabel ? `Assinar por ${priceLabel}/mês` : "Assinar agora"}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full rounded-xl" onClick={() => router.push("/subscription/checkout/")}>
                      Gerenciar Assinatura
                    </Button>
                  )}
                  
                  {!Capacitor.isNativePlatform() && !isPremiumActive && (
                    <p className="text-[10px] text-center text-zinc-400">Compras disponíveis apenas no app nativo Android.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-zinc-500 italic">{t("subscriptionNoTripHint")}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Informações e Rodapé */}
      <div className="container-page grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-none bg-zinc-100 dark:bg-zinc-900">
          <CardHeader><CardTitle className="text-base">Benefícios</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex gap-2"><span className="text-amber-500">✓</span> {t("planPaidBullet")}</div>
            <div className="flex gap-2"><span className="text-amber-500">✓</span> {t("validityBullet")}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none bg-red-50 dark:bg-red-950/20">
          <CardHeader><CardTitle className="text-base text-red-800 dark:text-red-400">{t("deleteDataTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-red-700/70 dark:text-red-400/60">{t("deleteDataDesc")}</p>
            <Button size="sm" variant="destructive" className="rounded-lg h-8 text-xs" onClick={async () => {
              try {
                Capacitor.isNativePlatform() ? (await logout(), setGoogleLogged(false)) : await signOut();
                show(t("deleteSuccess"), { variant: "success" });
              } catch { show(t("deleteError"), { variant: "error" }); }
            }}>
              {t("deleteDataButton")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
