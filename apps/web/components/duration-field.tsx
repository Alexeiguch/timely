"use client";
import { useId, useState } from "react";
import { Timer } from "lucide-react";
import { durationText, t } from "@timely/i18n";
import { useLanguage } from "./language-state";

const presets = [15, 30, 45, 60, 120];
export function DurationField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
}) {
  useLanguage();
  const id = useId();
  const [custom, setCustom] = useState(
    value !== null && !presets.includes(value),
  );
  const minutes = value ?? 30;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  const update = (next: number) => onChange(Math.max(1, Math.min(10080, next)));
  return (
    <fieldset className="duration-field">
      <legend>
        <Timer size={18} aria-hidden="true" /> {t("Duration")}{" "}
        <small>{t("Optional")}</small>
      </legend>
      <div className="chips" aria-label={t("How much time?")}>
        {[null, ...presets].map((choice) => (
          <button
            key={choice ?? "none"}
            type="button"
            aria-pressed={!custom && value === choice}
            aria-label={`${t("Duration")}: ${durationText(choice)}`}
            onClick={() => {
              setCustom(false);
              onChange(choice);
            }}
          >
            {durationText(choice)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => {
            setCustom(true);
            onChange(minutes);
          }}
        >
          {t("Custom")}
        </button>
      </div>
      {custom && (
        <div className="duration-custom">
          <strong aria-live="polite">{durationText(value)}</strong>
          <div className="duration-units">
            {[
              { label: t("Days"), amount: days, max: 7, step: 1440 },
              { label: t("Hours"), amount: hours, max: 23, step: 60 },
              { label: t("Minutes"), amount: remainder, max: 59, step: 1 },
            ].map((unit) => (
              <div key={unit.step}>
                <label htmlFor={`${id}-${unit.step}`}>{unit.label}</label>
                <select
                  id={`${id}-${unit.step}`}
                  value={unit.amount}
                  onChange={(event) =>
                    update(
                      minutes +
                        (Number(event.target.value) - unit.amount) * unit.step,
                    )
                  }
                >
                  {Array.from({ length: unit.max + 1 }, (_, index) => (
                    <option key={index} value={index}>
                      {index}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
      <small>{t("A time estimate, from 1 minute to 7 days.")}</small>
    </fieldset>
  );
}
