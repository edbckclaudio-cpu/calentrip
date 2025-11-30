"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTrip } from "@/lib/trip-context";
import { getTrips, TripItem } from "@/lib/trips-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isTripPremium, setTripPremium, computeExpiryFromData } from "@/lib/premium";
import { useEffect, useMemo, useState } from "react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { tripSearch } = useTrip();
  const [trips, setTrips] = useState<TripItem[]>([]);
  const currentTrip = useMemo(() => {
    const all = trips;
    return all.length ? all[0] : null;
  }, [trips]);
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
                  <Button type="button" variant="secondary" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/profile" })}>Entrar Demo</Button>
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
                        const returnDate = tripSearch && tripSearch.mode === "same" ? tripSearch.returnDate : undefined;
                        const expiresAt = computeExpiryFromData({ tripDate: currentTrip.date, returnDate });
                        setTripPremium(currentTrip.id, expiresAt);
                        window.location.href = "/calendar/final";
                      }}
                    >
                      Assinar agora (R$ 15)
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

