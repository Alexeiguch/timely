"use client";
import { t } from "@timely/i18n";
import { useLanguage } from "./language-state";
export function PublicLinks() {
  useLanguage();
  return (
    <nav className="public-links" aria-label={t("Help & privacy")}>
      <a href="/privacy">{t("Privacy policy")}</a>
      <a href="/support">{t("Support")}</a>
      <a href="/delete-account">{t("Account deletion")}</a>
    </nav>
  );
}
