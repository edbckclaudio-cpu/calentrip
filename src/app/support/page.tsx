"use client";
import { useI18n } from "@/lib/i18n";

export default function SupportPage() {
  const { t } = useI18n();
  return (
    <div className="container-page py-6 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--brand)]">{t("supportTitle")}</h1>
      <p className="text-sm text-zinc-700">{t("supportIntro")}</p>
      <p className="text-sm text-zinc-700">{t("supportIncludeInfo")}</p>
      <p className="text-sm text-zinc-700">{t("refundsInfo")}</p>
    </div>
  );
}
