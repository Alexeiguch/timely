import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Minus, Plus, Timer } from "lucide-react-native";
import { colors, surfaces } from "@timely/design";
import { durationText, t } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { Choices, IconButton, s } from "./ui";

const presets = [15, 30, 45, 60, 120];
export function DurationField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
}) {
  useLanguage();
  const [custom, setCustom] = useState(
    value !== null && !presets.includes(value),
  );
  const minutes = value ?? 30;
  return (
    <View style={s.field}>
      <View style={s.row}>
        <Timer size={18} color={colors.primary} accessible={false} />
        <Text style={s.label}>{t("Duration")}</Text>
        <Text style={s.muted}>{t("Optional")}</Text>
      </View>
      <Choices
        label={t("How much time?")}
        value={custom ? "custom" : String(value ?? "none")}
        options={[
          { value: "none", label: t("No duration") },
          ...presets.map((minutes) => ({
            value: String(minutes),
            label: durationText(minutes),
          })),
          { value: "custom", label: t("Custom") },
        ]}
        onChange={(choice) => {
          setCustom(choice === "custom");
          onChange(
            choice === "none"
              ? null
              : choice === "custom"
                ? minutes
                : Number(choice),
          );
        }}
      />
      {custom && (
        <View style={styles.custom}>
          <Text style={s.title} accessibilityLiveRegion="polite">
            {durationText(value)}
          </Text>
          {[
            {
              label: t("Days"),
              amount: Math.floor(minutes / 1440),
              step: 1440,
            },
            {
              label: t("Hours"),
              amount: Math.floor((minutes % 1440) / 60),
              step: 60,
            },
            { label: t("Minutes"), amount: minutes % 60, step: 1 },
          ].map((unit) => (
            <View key={unit.step} style={styles.unit}>
              <Text style={[s.body, s.grow]}>{unit.label}</Text>
              <IconButton
                label={t("Decrease {v0}", { v0: unit.label.toLowerCase() })}
                disabled={minutes - unit.step < 1}
                onPress={() => onChange(minutes - unit.step)}
              >
                <Minus size={18} color={colors.text} />
              </IconButton>
              <Text style={[s.title, styles.amount]}>{unit.amount}</Text>
              <IconButton
                label={t("Increase {v0}", { v0: unit.label.toLowerCase() })}
                disabled={minutes + unit.step > 10080}
                onPress={() => onChange(minutes + unit.step)}
              >
                <Plus size={18} color={colors.text} />
              </IconButton>
            </View>
          ))}
        </View>
      )}
      <Text style={s.muted}>
        {t("A time estimate, from 1 minute to 7 days.")}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  custom: {
    backgroundColor: surfaces.blue,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  unit: { flexDirection: "row", alignItems: "center", gap: 8 },
  amount: { minWidth: 28, textAlign: "center" },
});
