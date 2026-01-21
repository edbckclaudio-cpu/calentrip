"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useNativeAuth } from "@/lib/native-auth";
import { useI18n } from "@/lib/i18n";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

export default function SubscriptionCheckoutPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user: nativeUser, status: nativeStatus, authenticating } = useNativeAuth();
  const { t } = useI18n();
  const { show } = useToast();
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAndroid = typeof window !== "undefined" && Capacitor.isNativePlatform();
  let graceUntil = 0;
  try { graceUntil = typeof window !== "undefined" ? Number(localStorage.getItem("calentrip:auth_grace_until") || "0") : 0; } catch {}
  const now = typeof window !== "undefined" ? Date.now() : 0;
  const graceActive = isAndroid && graceUntil > now;
  const isLoadingGate = status === "loading" || authenticating || graceActive;

  async function handlePurchase() {
    try {
      setLoading(true);
      if (Capacitor.getPlatform() !== "android") {
        try { alert("Disponível no app Android. Instale via Google Play."); } catch {}
        return;
      }
      const mod = await import("@/lib/billing");
      const userId = nativeUser?.email || nativeUser?.name || session?.user?.email || session?.user?.name || undefined;
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

  if (isLoadingGate) {
    return (
      <div className="min-h-screen px-4 py-6 space-y-6">
        <div className="container-page flex items-center gap-2">
          <div className="h-10 w-10 rounded-full border-2 border-zinc-300 border-t-[var(--brand)] animate-spin" aria-label="Carregando" />
          <div>
            <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Carregando</h1>
            <p className="text-sm text-zinc-600">Preparando checkout e sessão…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-lg"
          onClick={async () => {
            const isAndroid = Capacitor.isNativePlatform();
            if (isAndroid) {
              if (authenticating) return;
              const hasUser = !!nativeUser;
              if (hasUser) { router.push("/profile"); return; }
              let graceUntil = 0;
              try { graceUntil = Number(localStorage.getItem("calentrip:auth_grace_until") || "0"); } catch {}
              const now = Date.now();
              if (graceUntil > now) {
                await new Promise((r) => setTimeout(r, Math.min(3000, graceUntil - now)));
              } else {
                await new Promise((r) => setTimeout(r, 3000));
              }
              if (!nativeUser) {
                try { console.log("REDIRECIONAMENTO: Expulsando para Home. Motivo: User Null"); } catch {}
                router.push("/");
              } else {
                router.push("/profile");
              }
              return;
            }
            const hasUserWeb = !!session?.user;
            if (!hasUserWeb) {
              try { console.log("REDIRECIONAMENTO: Expulsando para Home. Motivo: User Null"); } catch {}
            }
            router.push(hasUserWeb ? "/profile" : "/");
          }}
        >
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
            <Button type="button" className="h-11 rounded-lg font-semibold tracking-wide flex items-center justify-center gap-2" disabled={loading || (Capacitor.getPlatform() === "android" ? !nativeUser : !session?.user)} onClick={handlePurchase}>
              {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : null}
              {price ? `Finalizar Assinatura (${price}/mês)` : "Finalizar Assinatura"}
            </Button>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
