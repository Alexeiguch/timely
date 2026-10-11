"use client";
import { Flame, Sparkles } from "lucide-react";
import { t } from "@timely/i18n";
import { useLanguage } from "./language-state";

export function StreakSetting({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  useLanguage();
  return (
    <div className={`streak-setting${enabled ? " is-enabled" : ""}`}>
      <label className="streak-toggle">
        <span>{t("Track a streak")}</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
      <div className="streak-setting-hero">
        <div className="streak-fire" aria-hidden="true">
          <span className="streak-halo" />
          <Flame size={58} className="streak-flame" strokeWidth={1.7} />
          {enabled && <Sparkles size={20} className="streak-spark" />}
        </div>
        <div>
          <strong>
            {enabled ? t("Keep your fire going.") : t("Small wins add up.")}
          </strong>
          <p>{t("One repeat. One little win. A stronger streak.")}</p>
        </div>
      </div>
      <p>
        {t(
          "Complete each occurrence before its deadline to keep your streak. Skipping is unavailable.",
        )}
      </p>
      <small>
        {t(
          "Untimed tasks are due at the end of the day; timed tasks are due at their time plus duration.",
        )}
      </small>
    </div>
  );
}
