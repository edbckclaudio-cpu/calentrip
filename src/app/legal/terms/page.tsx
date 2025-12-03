"use client";
import { useI18n } from "@/lib/i18n";

export default function TermsPage() {
  const { t } = useI18n();
  return (
    <div className="container-page py-6 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--brand)]">{t("termsTitle")}</h1>
      <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        <p>{t("termsIntro")}</p>
        <p>{t("termsResponsibilities")}</p>
        <p>{t("termsSubscriptionPayment")}</p>
        <p>{t("termsDataPrivacyLink")}</p>
        <p>{t("termsSupportContact")}</p>
      </div>
    </div>
  );
}
