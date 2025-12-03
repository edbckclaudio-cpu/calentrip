"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTrip } from "@/lib/trip-context";
import { getTrips, TripItem } from "@/lib/trips-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isTripPremium } from "@/lib/premium";
import { useToast } from "@/components/ui/toast";
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
  const [premiumUntil, setPremiumUntil] = useState("");
  const { show } = useToast();

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
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Perfil</h1>
        <p className="text-sm text-zinc-600">Gerencie sua conta e assinatura mensal.</p>
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
            <CardTitle>Assinatura mensal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {currentTrip ? (
              <>
                <div>Viagem atual: {currentTrip.title} • Data: {currentTrip.date}</div>
                <div>Status: {premiumActive ? `Ativa${premiumUntil ? ` (até ${premiumUntil})` : ""}` : "Inativa"}</div>
                <div className="space-y-2">
                  <div className="text-zinc-600">Plano mensal de R$ 15: desbloqueia edição de atividades, salvar calendário e recursos premium durante 30 dias para todas as viagens.</div>
                  {!premiumActive ? (
                    <Button
                      type="button"
                      className="h-11 rounded-lg font-semibold tracking-wide"
                      onClick={async () => {
                        try {
                          const mod = await import("@/lib/billing");
                          const userId = session?.user?.email || session?.user?.name || undefined;
                          const r = await mod.completePurchaseForTrip("global", userId);
                          if (r?.ok) { show("Assinatura ativada", { variant: "success" }); window.location.href = "/calendar/final"; }
                          else show("Falha na compra", { variant: "error" });
                        } catch { show("Erro na compra", { variant: "error" }); }
                      }}
                    >
                      Assinar agora (R$ 15/mês)
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
            <div>• Grátis: busca de voos, definição de destino, hospedagem e planejamento básico.</div>
            <div>• Pago (mensal): edição de atividades/restaurantes, salvar calendário, exportações avançadas e recursos premium.</div>
            <div>• Validade: 30 dias após a compra; após expirar, você continua consultando calendários salvos.</div>
            <div>• Compras: processadas pelo Google Play. Reembolsos seguem as regras do Google Play.</div>
            <div>• Privacidade e termos: consulte as páginas de Política de Privacidade e Termos de Uso.</div>
          </CardContent>
        </Card>
      </div>

      <div className="container-page">
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>Exclusão de conta e dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Você pode solicitar a exclusão dos seus dados e entitlements vinculados à conta.</div>
            <Button type="button" variant="outline" onClick={async () => {
              try {
                const r = await fetch("/api/account/delete", { method: "POST" });
                const js = await r.json();
                if (js?.ok) show("Solicitação registrada. Dados removidos.", { variant: "success" });
                else show("Não foi possível processar a solicitação.", { variant: "error" });
              } catch { show("Erro na solicitação.", { variant: "error" }); }
            }}>Excluir conta e dados</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

