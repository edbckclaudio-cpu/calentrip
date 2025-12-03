"use client";
import { useI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const { t } = useI18n();
  return (
    <div className="container-page py-6 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--brand)]">{t("privacyTitle")}</h1>
      <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        <p>{t("privacyIntro")}</p>
        <p>{t("privacyDataCategories")}</p>
        <ul className="list-disc pl-5">
          <li>{t("privacyDataLocation")}</li>
          <li>{t("privacyDataPurchases")}</li>
          <li>{t("privacyDataPrefs")}</li>
          <li>{t("privacyDataAttachments")}</li>
        </ul>
        <p>{t("privacySharing")}</p>
        <p>{t("privacyRetention")}</p>
        <p>{t("privacyUserRights")}</p>
        <p>{t("privacyContact")}</p>
      </div>
    </div>
  );
}
