"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTrip } from "@/lib/trip-context";
import { getTrips, TripItem } from "@/lib/trips-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isTripPremium, setTripPremium, computeExpiryFromData } from "@/lib/premium";
import { isBillingReady, ensureProduct, purchaseTripPremium } from "@/lib/billing";
import { useEffect, useMemo, useState } from "react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { tripSearch } = useTrip();
  const [trips, setTrips] = useState<TripItem[]>([]);
  const currentTrip = useMemo(() => { const all = trips; return all.length ? all[0] : null; }, [trips]);
  const premiumActive = useMemo(() => (currentTrip ? isTripPremium(currentTrip.id) : false), [currentTrip]);

  useEffect(() => { setTrips(getTrips()); }, []);

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Perfil</h1>
        <p className="text-sm text-zinc-600">Gerencie sua conta e assinatura por viagem.</p>
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
                <div>Você está navegando como convidado.</div>
                <div className="flex gap-2 mt-2">
                  <Button type="button" onClick={() => signIn("google")}>Entrar com Google</Button>
                  {process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === "1" ? (
                    <Button type="button" variant="secondary" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/profile" })}>Entrar Demo</Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>Assinatura por viagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {currentTrip ? (
              <>
                <div>Viagem atual: {currentTrip.title} • Data: {currentTrip.date}</div>
                <div>Status: {premiumActive ? "Ativa" : "Inativa"}</div>
                {premiumActive ? (
                  <div className="text-zinc-600">A assinatura vale até o último dia desta viagem. Após este período, você ainda poderá consultar o calendário, mas novas viagens exigirão nova assinatura.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-zinc-600">Assinatura única de R$ 15 por viagem. Desbloqueia calendário final e recursos avançados.</div>
                    <Button
                      type="button"
                      className="h-11 rounded-lg font-semibold tracking-wide"
                      onClick={() => {
                        (async () => {
                          const ready = await isBillingReady();
                          if (ready) {
                            await ensureProduct("trip_premium");
                            const res = await purchaseTripPremium("trip_premium");
                            if ((res?.code ?? -1) == 0) {
                              const token = await (await import("@/lib/billing")).awaitPurchaseToken(12000);
                              try {
                                if (token) {
                                  const v = await fetch("/api/entitlements/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: currentTrip.id, productId: "trip_premium", purchaseToken: token }) }).then((r) => r.json());
                                  if (!v?.ok) throw new Error("verify failed");
                                  await fetch("/api/entitlements/ack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: "trip_premium", purchaseToken: token }) });
                                  const retDate = tripSearch && tripSearch.mode === "same" ? tripSearch.returnDate : undefined;
                                  const exp = computeExpiryFromData({ tripDate: currentTrip.date, returnDate: retDate });
                                  await fetch("/api/entitlements/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: currentTrip.id, expiresAt: exp, orderId: v?.orderId || null, source: "google_play" }) });
                                }
                              } catch {}
                              const returnDate = tripSearch && tripSearch.mode === "same" ? tripSearch.returnDate : undefined;
                              const expiresAt = computeExpiryFromData({ tripDate: currentTrip.date, returnDate });
                              setTripPremium(currentTrip.id, expiresAt);
                              window.location.href = "/calendar/final";
                              return;
                            }
                          }
                          const returnDate = tripSearch && tripSearch.mode === "same" ? tripSearch.returnDate : undefined;
                          const expiresAt = computeExpiryFromData({ tripDate: currentTrip.date, returnDate });
                          setTripPremium(currentTrip.id, expiresAt);
                          window.location.href = "/calendar/final";
                        })();
                      }}
                    >
                      Assinar agora (R$ 15)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        (async () => {
                          try {
                            const token = await (await import("@/lib/billing")).awaitPurchaseToken(6000);
                            if (token && currentTrip) {
                              const v = await fetch("/api/entitlements/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: currentTrip.id, productId: "trip_premium", purchaseToken: token }) }).then((r) => r.json());
                              if (v?.ok) {
                                await fetch("/api/entitlements/ack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: "trip_premium", purchaseToken: token }) });
                                const retDate = tripSearch && tripSearch.mode === "same" ? tripSearch.returnDate : undefined;
                                const exp = computeExpiryFromData({ tripDate: currentTrip.date, returnDate: retDate });
                                await fetch("/api/entitlements/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: currentTrip.id, expiresAt: exp, orderId: v?.orderId || null, source: "google_play_restore" }) });
                                const returnDate = tripSearch && tripSearch.mode === "same" ? tripSearch.returnDate : undefined;
                                const expiresAt = computeExpiryFromData({ tripDate: currentTrip.date, returnDate });
                                setTripPremium(currentTrip.id, expiresAt);
                                window.location.href = "/calendar/final";
                              }
                            }
                          } catch {}
                        })();
                      }}
                    >
                      Restaurar compras (Android)
                    </Button>
                  </div>
                )}
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
            <div>• O que é grátis: busca de voos, definição de destino, hospedagem e planejamento básico.</div>
            <div>• O que é pago: calendário final completo, sugestões avançadas e recursos premium durante a viagem.</div>
            <div>• Validade: a assinatura é válida até o último dia da viagem; depois, você continua consultando o calendário, mas para uma nova viagem é necessário assinar novamente.</div>
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  (async () => {
                    try {
                      await fetch("/api/account/delete", { method: "POST" });
                    } catch {}
                    try {
                      if (typeof window !== "undefined") {
                        localStorage.removeItem("calentrip:trips");
                        localStorage.removeItem("calentrip:premium");
                        localStorage.removeItem("calentrip:tripSearch");
                        localStorage.removeItem("calentrip:saved_calendar");
                        localStorage.removeItem("calentrip:entertainment:records");
                      }
                    } catch {}
                    try { await signOut(); } catch {}
                    try { window.location.href = "/flights/search"; } catch {}
                  })();
                }}
              >
                Excluir conta e dados locais
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
