 "use client";
 import { useMemo, useState } from "react";
 import { useRouter } from "next/navigation";
 import { useI18n } from "@/lib/i18n";
 import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 
 type PremiumRecord = { tripId: string; expiresAt: number };
 
 export default function SubscriptionSuccessPage() {
   const router = useRouter();
   const { t } = useI18n();
  const [expiresAt] = useState<number | null>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:premium") : null;
      const list: PremiumRecord[] = raw ? JSON.parse(raw) : [];
      const rec = list.find((r) => r.tripId === "global");
      return rec ? Number(rec.expiresAt || 0) : null;
    } catch {
      return null;
    }
  });
 
   const expiresLabel = useMemo(() => {
     if (!expiresAt || !Number.isFinite(expiresAt)) return "";
     const d = new Date(expiresAt);
     const dd = String(d.getDate()).padStart(2, "0");
     const mm = String(d.getMonth() + 1).padStart(2, "0");
     const yyyy = String(d.getFullYear());
     const hh = String(d.getHours()).padStart(2, "0");
     const mi = String(d.getMinutes()).padStart(2, "0");
     return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
   }, [expiresAt]);
 
   return (
     <div className="min-h-screen px-4 py-6 space-y-6">
       <div className="container-page">
         <Card className="rounded-xl shadow-md">
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <span className="material-symbols-outlined text-emerald-600">check_circle</span>
               {t("purchaseSuccess")}
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-3">
             <div className="text-sm text-zinc-700">
               Sua assinatura foi ativada com sucesso. {expiresLabel ? `${t("untilWord")} ${expiresLabel}.` : ""}
             </div>
             <div className="text-xs text-zinc-500">
               Você pode acessar os recursos premium imediatamente. Para criar/editar calendários e atividades, siga para o calendário.
             </div>
             <div className="flex items-center gap-2">
               <Button type="button" className="h-10 rounded-lg" onClick={() => { try { router.push("/"); } catch {} }}>
                 Ir para Tela Inicial
               </Button>
               <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={() => { try { router.push("/calendar/final"); } catch {} }}>
                 Abrir Calendário
               </Button>
             </div>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }
