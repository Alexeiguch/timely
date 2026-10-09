"use client";
import { useEffect, type ReactNode } from "react";
import { languageStorageKey, locale, setLanguage, t } from "@timely/i18n";
import {
  LanguageProvider,
  useLanguage,
  useLanguagePersistence,
  type LanguageStorage,
} from "./language-state";
const storage: LanguageStorage = {
  read: () => localStorage.getItem(languageStorageKey),
  write: (value) => localStorage.setItem(languageStorageKey, value),
  listen: (changed) => {
    const handle = (event: StorageEvent) => {
      if (event.key === languageStorageKey) changed(event.newValue);
    };
    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  },
};
function DocumentLanguage() {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t("Timely — A little space for your day");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("Your personal planner, at your pace."));
  }, [language]);
  return null;
}
export function LanguageRoot({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider storage={storage}>
      <DocumentLanguage />
      {children}
    </LanguageProvider>
  );
}
export function LanguageChoice() {
  const language = useLanguage();
  const { error } = useLanguagePersistence();
  return (
    <div className="language-choice">
      <div className="row" role="group" aria-label={t("Language")}>
        <span>{t("Language")}</span>
        <button
          type="button"
          lang="es"
          aria-pressed={language === "es"}
          onClick={() => setLanguage("es")}
        >
          Español
        </button>
        <button
          type="button"
          lang="en"
          aria-pressed={language === "en"}
          onClick={() => setLanguage("en")}
        >
          English
        </button>
      </div>
      {error && (
        <small role="status">
          {t("Language changed for now. Could not save it on this device.")}
        </small>
      )}
    </div>
  );
}
