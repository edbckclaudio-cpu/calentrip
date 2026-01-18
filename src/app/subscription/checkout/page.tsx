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
      if (Capacitor.getPlatform() !== "android") {
        try { alert("Disponível no app Android. Instale via Google Play."); } catch {}
        return;
      }
      const mod = await import("@/lib/billing");
      const userId = session?.user?.email || session?.user?.name || undefined;
      const r = await mod.completePurchaseForTrip("global", userId);
      if (r?.ok) { show(t("purchaseSuccess"), { variant: "success" }); router.push("/profile"); }
      else {
        const msg = r?.error === "billing"
          ? "Disponível no app Android. Instale via Google Play."
          : r?.error === "product" ? "Produto não encontrado no Google Play."
          : r?.error === "purchase" ? "Compra cancelada ou falhou."
          : r?.error === "token" ? "Token de compra não recebido."
          : r?.error === "verify" ? "Falha ao verificar a compra."
          : r?.error === "ack" ? "Falha ao confirmar a compra."
          : r?.error === "store" ? "Falha ao salvar assinatura."
          : "Falha na compra";
        show(msg, { variant: "error" });
      }
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
        <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={() => router.push(session?.user ? "/profile" : "/")}>
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
            <div className="text-xs text-zinc-500">Compras: processadas pelo Google Play, renovação automática. Cancele a qualquer momento nas configurações da Play Store.</div>
            <Button type="button" className="h-11 rounded-lg font-semibold tracking-wide flex items-center justify-center gap-2" disabled={loading || !session?.user} onClick={handlePurchase}>
              {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : null}
              {price ? `Finalizar Assinatura (${price}/mês)` : "Finalizar Assinatura"}
            </Button>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
