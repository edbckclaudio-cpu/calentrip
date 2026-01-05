"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";

export default function SubscriptionCheckoutPage() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const mod = await import("@/lib/billing");
        const info = await mod.ensureProduct(process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "trip_premium");
        if (info?.price) setPrice(info.price);
      } catch {}
    })();
  }, []);

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page flex items-center gap-3">
        <button type="button" className="rounded-md p-2 border border-zinc-200 dark:border-zinc-800" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
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
            <Button
              type="button"
              className="h-11 rounded-lg font-semibold tracking-wide"
              disabled={loading}
              onClick={async () => {
                try {
                  setLoading(true);
                  const mod = await import("@/lib/billing");
                  const userId = session?.user?.email || session?.user?.name || undefined;
                  const r = await mod.completePurchaseForTrip("global", userId);
                  if (r?.ok) { window.location.href = "/profile"; }
                } catch {}
                finally { setLoading(false); }
              }}
            >
              {price ? `Comprar (${price}/mês)` : "Comprar"}
            </Button>
            <div className="text-xs text-zinc-500">Se estiver no navegador, abra o app Android instalado via Google Play para concluir.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
