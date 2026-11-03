"use client";
import { t } from "@timely/i18n";
import { LanguageChoice } from "./language";
import { useLanguage } from "./language-state";
import { PublicLinks } from "./public-links";
import { publicPages, deletionSteps } from "../lib/public-pages";
export function PublicPage({ kind }: { kind: keyof typeof publicPages }) {
  useLanguage();
  const page = publicPages[kind];
  return (
    <main className="public-page">
      <header className="public-page-header">
        <a className="brand" href="/" aria-label={t("Open Timely")}>{t("Timely")}</a>
        <LanguageChoice />
      </header>
      <article className="public-page-card">
        <h1>{t(page.title)}</h1>
        {kind === "privacy" && <p className="public-page-notice"><strong>{t("Draft — awaiting operator review")}</strong></p>}
        <p>{t(page.intro)}</p>
        {kind === "delete-account" && <>
          <ol>{deletionSteps.map((step) => <li key={step}>{t(step)}</li>)}</ol>
          <a className="public-page-action" href="/">{t("Open Timely")}</a>
        </>}
        {page.sections.map((section) => <section key={section.heading}>
          <h2>{t(section.heading)}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{t(paragraph)}</p>)}
        </section>)}
      </article>
      <PublicLinks />
    </main>
  );
}
