"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";

export default function SubscriptionCheckoutPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useI18n();
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function handlePurchase() {
    try {
      setLoading(true);
      const mod = await import("@/lib/billing");
      if (!mod || typeof mod.completePurchaseForTrip !== "function") {
        try { alert("Compra indisponível no momento."); } catch {}
        return;
      }
      const userId = session?.user?.email || session?.user?.name || undefined;
      const r = await mod.completePurchaseForTrip("global", userId);
      if (r?.ok) { window.location.href = "/profile"; }
    } catch {
      try { alert("Falha ao iniciar a compra."); } catch {}
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const mod = await import("@/lib/billing");
        const info = await mod.ensureProduct(process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01");
        if (info?.price) setPrice(info.price);
      } catch {}
    })();
  }, []);

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page flex items-center gap-2">
        <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={() => { try { router.push(session?.user ? "/profile" : "/"); } catch {} }}>
          Voltar
        </Button>
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Assinatura</h1>
          <p className="text-sm text-zinc-600">Plano Premium mensal</p>
        </div>
      </div>
      <div className="container-page grid gap-4 md:grid-cols-2">
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>Benefícios Premium</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• Atividades</div>
            <div>• Calendário</div>
            <div>• Exportação avançada</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>Checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-zinc-600">Pagamento via Google Play Billing</div>
            <div className="text-xs text-zinc-500">
              Sua assinatura será cobrada na sua conta da Google Play e renovada automaticamente. Você pode cancelar a qualquer momento nas configurações da Play Store.
            </div>
            <Button type="button" className="h-11 rounded-lg font-semibold tracking-wide flex items-center justify-center gap-2" disabled={loading || !session?.user} onClick={handlePurchase}>
              {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : null}
              {price ? `Fazer Pagamento (${price}/mês)` : "Fazer Pagamento"}
            </Button>
            {Capacitor.getPlatform() !== "android" ? (
              <div className="text-xs text-zinc-600">
                Para concluir a compra, abra o app CalenTrip instalado no seu Android.
                <div className="mt-2">
                  <Button type="button" variant="outline" onClick={() => { try { window.location.href = "intent://subscription/checkout#Intent;scheme=https;package=digital.calentrip.android;end"; } catch {} }}>
                    Abrir no app
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
