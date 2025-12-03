"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTrip } from "@/lib/trip-context";
import { getTrips, TripItem } from "@/lib/trips-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isTripPremium } from "@/lib/premium";
import { useToast } from "@/components/ui/toast";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { tripSearch } = useTrip();
  const [trips, setTrips] = useState<TripItem[]>([]);
  const currentTrip = useMemo(() => {
    const all = trips;
    return all.length ? all[0] : null;
  }, [trips]);
  const premiumActive = useMemo(() => (currentTrip ? isTripPremium(currentTrip.id) : false), [currentTrip]);
  const [premiumUntil, setPremiumUntil] = useState("");
  const { show } = useToast();
  const { t } = useI18n();

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

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">{t("profileTitle")}</h1>
        <p className="text-sm text-zinc-600">{t("profileSubtitleMonthly")}</p>
      </div>

      <div className="container-page grid gap-4 md:grid-cols-2">
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>Conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {status === "authenticated" ? (
              <>
                <div>Nome: {session?.user?.name || "Usuário"}</div>
                <div>E-mail: {session?.user?.email || ""}</div>
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" onClick={() => signOut()}>Sair</Button>
                </div>
              </>
            ) : (
              <>
                <div>{t("loginUnlockText")}</div>
                <div className="flex gap-2 mt-2">
                  <Button type="button" onClick={() => signIn("google")}>{t("signInWithGoogle")}</Button>
                  <Button type="button" variant="secondary" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/profile" })}>{t("signInDemo")}</Button>
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
                  {!premiumActive ? (
                    <Button
                      type="button"
                      className="h-11 rounded-lg font-semibold tracking-wide"
                      onClick={async () => {
                        try {
                          const mod = await import("@/lib/billing");
                          const userId = session?.user?.email || session?.user?.name || undefined;
                          const r = await mod.completePurchaseForTrip("global", userId);
                          if (r?.ok) { show(t("purchaseSuccess"), { variant: "success" }); window.location.href = "/calendar/final"; }
                          else show(t("purchaseFail"), { variant: "error" });
                        } catch { show(t("purchaseError"), { variant: "error" }); }
                      }}
                    >
                      {t("subscribeMonthlyButton")}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <div>Nenhuma viagem selecionada. Salve sua busca de voos para habilitar a assinatura.</div>
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

