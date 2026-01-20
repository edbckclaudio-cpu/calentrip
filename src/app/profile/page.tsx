"use client";
import { useSession, signOut } from "next-auth/react";
import { getTrips, TripItem } from "@/lib/trips-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isTripPremium } from "@/lib/premium";
import { useToast } from "@/components/ui/toast";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Capacitor } from "@capacitor/core";
import { useNativeAuth } from "@/lib/native-auth";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { user: nativeUser, status: nativeStatus, loginWithGoogle, logout } = useNativeAuth();
  const [googleLogged, setGoogleLogged] = useState(false);
  const [trips, setTrips] = useState<TripItem[]>([]);
  const currentTrip = useMemo(() => {
    const all = trips;
    return all.length ? all[0] : null;
  }, [trips]);
  const premiumActive = useMemo(() => (currentTrip ? isTripPremium(currentTrip.id) : false), [currentTrip]);
  const [premiumUntil, setPremiumUntil] = useState("");
  const { show } = useToast();
  const { t } = useI18n();
  const [priceLabel, setPriceLabel] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    setTrips(getTrips());
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:premium") : null;
      const list: Array<{ tripId: string; expiresAt: number }> = raw ? JSON.parse(raw) : [];
      const rec = list.find((r) => r.tripId === "global" && r.expiresAt > Date.now());
      if (rec) {
        const d = new Date(rec.expiresAt);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        setPremiumUntil(`${dd}/${mm}`);
      } else setPremiumUntil("");
    } catch { setPremiumUntil(""); }
  }, []);

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
        try { await loginWithGoogle(); setGoogleLogged(true); } catch (error) { try { console.error("Erro no Login:", error); alert("Erro Google: " + JSON.stringify(error)); } catch {} }
      }
      if (!isNative) {
        try { window.location.href = "/login?next=/profile"; } catch (error) { try { console.error("Erro no Login:", error); alert("Erro Google: " + JSON.stringify(error)); } catch {} }
      }
    } catch (error) {
      try { console.error("Erro no Login:", error); alert("Erro Google: " + JSON.stringify(error)); } catch {}
    } finally {
      setIsSigning(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page flex items-center gap-3">
        <button type="button" className="rounded-md p-2 border border-zinc-200 dark:border-zinc-800" onClick={() => { try { window.location.href = "/flights/search"; } catch {} }}>
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">{t("profileTitle")}</h1>
          <p className="text-sm text-zinc-600">{t("profileSubtitleMonthly")}</p>
        </div>
      </div>
      <div className="container-page flex justify-center">
        <Button
          type="button"
          className="h-12 w-64 bg-[var(--brand)] text-white font-semibold rounded-lg shadow-lg hover:brightness-95"
          onClick={() => {
            try { window.location.href = "/"; } catch {}
          }}
        >
          Ir para Tela Inicial
        </Button>
      </div>

      <div className="container-page grid gap-4 md:grid-cols-2">
        <Card
          className="rounded-xl shadow-md"
        >
          <CardHeader>
            <CardTitle>Conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(Capacitor.isNativePlatform() ? googleLogged : status === "authenticated") ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm">{(Capacitor.isNativePlatform() ? (nativeUser?.name || nativeUser?.email || "PF") : (session?.user?.name || session?.user?.email || "PF")).slice(0, 2).toUpperCase()}</span>
                  <div>
                    <div className="text-sm font-semibold">{Capacitor.isNativePlatform() ? (nativeUser?.name || "Usuário") : (session?.user?.name || "Usuário")}</div>
                    <div className="text-xs text-zinc-600">{Capacitor.isNativePlatform() ? (nativeUser?.email || "") : (session?.user?.email || "")}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button type="button" variant="outline" onClick={() => { try { window.location.href = "/subscription/checkout"; } catch {} }}>Pagamento</Button>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" onClick={async () => {
                    try {
                      if (Capacitor.isNativePlatform()) {
                        await logout();
                        setGoogleLogged(false);
                      } else {
                        await signOut();
                      }
                    } catch {}
                  }}>Sair</Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg p-4 text-center border border-zinc-200 dark:border-zinc-800">
                  <div className="text-base font-semibold mb-3">Entre com sua conta Google</div>
                  <Button
                    type="button"
                    className="h-10 rounded-lg bg-white text-black border border-zinc-300 hover:bg-zinc-50 flex items-center justify-center gap-2"
                    disabled={isSigning}
                    onClick={(e) => { try { e.stopPropagation(); handleGoogleLogin(); } catch {} }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 31.9 29.3 35 24 35c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.4l5.7-5.7C33.7 3.2 29.1 1 24 1 16.3 1 9.6 5.3 6.3 11.7z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.3 16.3 18.8 13 24 13c3.3 0 6.3 1.2 8.6 3.4l5.7-5.7C33.7 3.2 29.1 1 24 1 16.3 1 9.6 5.3 6.3 11.7z"/>
                      <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.9 36.6 27.1 37.7 24 37.7c-5.3 0-9.8-3.3-11.4-7.9l-6.4 5C9.6 42.7 16.3 47 24 47z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.7 3.9-5.7 6.7-11.3 6.7-5.3 0-9.8-3.3-11.4-7.9l-6.4 5C9.6 42.7 16.3 47 24 47c12.1 0 21-9.8 21-21 0-1.7-.2-3.3-.4-4.5z"/>
                    </svg>
                    Entrar com Google
                  </Button>
                  <div className="mt-3 text-xs text-zinc-500">Ao entrar, usaremos seu nome, e-mail e foto da sua conta Google.</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>{t("subscriptionMonthlyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {currentTrip ? (
              <>
                <div>{t("currentTripLabel")}: {currentTrip.title} • {currentTrip.date}</div>
                <div>{t("statusLabel")}: {premiumActive ? `${t("activeStatus")}${premiumUntil ? ` (${t("untilWord")} ${premiumUntil})` : ""}` : t("inactiveStatus")}</div>
                <div className="space-y-2">
                  <div className="text-zinc-600">{t("subMonthlyText")}</div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => { try { window.location.href = "/subscription/checkout"; } catch {} }}>
                      Assinar agora
                    </Button>
                    <span className="text-xs text-zinc-500">Revisar benefícios e concluir compra</span>
                  </div>
                  {!premiumActive ? (
                    <Button
                      type="button"
                      className="h-11 rounded-lg font-semibold tracking-wide"
                      disabled={purchasing}
                      onClick={async () => {
                        try {
                          setPurchasing(true);
                          const mod = await import("@/lib/billing");
                          const userId = session?.user?.email || session?.user?.name || undefined;
                          const r = await mod.completePurchaseForTrip("global", userId);
                          if (r?.ok) { show(t("purchaseSuccess"), { variant: "success" }); window.location.href = "/calendar/final"; }
                          else {
                            const msg = r?.error === "billing"
                              ? "Disponível no app Android. Instale via Google Play."
                              : r?.error === "product" ? "Produto não encontrado no Google Play."
                              : r?.error === "purchase" ? "Compra cancelada ou falhou."
                              : r?.error === "token" ? "Token de compra não recebido."
                              : r?.error === "verify" ? "Falha ao verificar a compra."
                              : r?.error === "ack" ? "Falha ao confirmar a compra."
                              : r?.error === "store" ? "Falha ao salvar assinatura."
                              : t("purchaseFail");
                            show(msg, { variant: "error" });
                          }
                        } catch { show(t("purchaseError"), { variant: "error" }); }
                        finally { setPurchasing(false); }
                      }}
                    >
                      {priceLabel ? `${t("subscribeMonthlyButton").split("(")[0].trim()} (${priceLabel}/mês)` : t("subscribeMonthlyButton")}
                    </Button>
                  ) : null}
                  {!Capacitor.isNativePlatform() && !purchasing ? (
                    <div className="text-xs text-zinc-500">Para comprar, abra o app Android instalado via Google Play.</div>
                  ) : null}
                </div>
              </>
            ) : (
              <div>{t("subscriptionNoTripHint")}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="container-page">
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>{t("planFreeBullet")}</div>
            <div>{t("planPaidBullet")}</div>
            <div>{t("validityBullet")}</div>
            <div>{t("billingBullet")}</div>
            <div>{t("legalBullet")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="container-page">
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>{t("deleteDataTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>{t("deleteDataDesc")}</div>
            <Button type="button" variant="outline" onClick={async () => {
              try {
                const r = await fetch("/api/account/delete", { method: "POST" });
                const js = await r.json();
                if (js?.ok) show(t("deleteSuccess"), { variant: "success" });
                else show(t("deleteFail"), { variant: "error" });
              } catch { show(t("deleteError"), { variant: "error" }); }
            }}>{t("deleteDataButton")}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

