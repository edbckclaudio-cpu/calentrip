"use client";
import { ReactNode } from "react";
import { TripProvider } from "@/lib/trip-context";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/toast";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <TripProvider>
          <ToastProvider>{children}</ToastProvider>
        </TripProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
