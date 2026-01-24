import { Crown, User } from "lucide-react";
import { cn } from "@/lib/utils"; // Utilitário padrão do shadcn/tailwind

interface PremiumBadgeProps {
  isPremium: boolean;
  className?: string;
}

export function PremiumBadge({ isPremium, className }: PremiumBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-500 gap-1.5 shadow-sm",
        isPremium 
          ? "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-white animate-gradient-x border border-amber-300/30" 
          : "bg-slate-200 text-slate-500 border border-slate-300/50",
        className
      )}
    >
      {isPremium ? (
        <>
          <Crown className="w-3 h-3 fill-white" />
          <span>Assinante Premium</span>
        </>
      ) : (
        <>
          <User className="w-3 h-3" />
          <span>Conta Gratuita</span>
        </>
      )}
    </div>
  );
}