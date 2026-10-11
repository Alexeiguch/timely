import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Flame, Sparkles } from "lucide-react-native";
import { colors, surfaces } from "@timely/design";
import { t } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { s } from "./ui";

export function StreakSetting({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  useLanguage();
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    let mounted = true;
    let changed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted && !changed) setReduceMotion(value);
    });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        changed = true;
        setReduceMotion(value);
      },
    );
    const app = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, []);
  useEffect(() => {
    pulse.setValue(0);
    if (!enabled || reduceMotion || !active) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 780,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      pulse.setValue(0);
    };
  }, [enabled, reduceMotion, active, pulse]);
  return (
    <View style={[styles.card, enabled && styles.enabled]}>
      <View style={s.row}>
        <Text style={[s.section, s.grow]}>{t("Track a streak")}</Text>
        <Switch
          accessibilityLabel={t("Track a streak")}
          value={enabled}
          trackColor={{ false: surfaces.inputBorder, true: colors.primary }}
          onValueChange={onChange}
        />
      </View>
      <View style={styles.hero}>
        <View
          style={styles.art}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View
            style={[
              styles.halo,
              {
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.65],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={{
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.18],
                  }),
                },
                {
                  rotate: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-5deg", "5deg"],
                  }),
                },
              ],
            }}
          >
            <Flame
              size={58}
              strokeWidth={1.7}
              color={colors.text}
              fill={enabled ? colors.orange : surfaces.orange}
            />
          </Animated.View>
          {enabled && (
            <Animated.View
              style={[
                styles.spark,
                {
                  opacity: pulse.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, -18],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Sparkles size={20} color={colors.primary} />
            </Animated.View>
          )}
        </View>
        <View style={s.grow}>
          <Text style={s.title}>
            {enabled ? t("Keep your fire going.") : t("Small wins add up.")}
          </Text>
          <Text style={s.body}>
            {t("One repeat. One little win. A stronger streak.")}
          </Text>
        </View>
      </View>
      <Text style={s.body}>
        {t(
          "Complete each occurrence before its deadline to keep your streak. Skipping is unavailable.",
        )}
      </Text>
      <Text style={s.muted}>
        {t(
          "Untimed tasks are due at the end of the day; timed tasks are due at their time plus duration.",
        )}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: surfaces.orange,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.orange,
  },
  enabled: { backgroundColor: surfaces.orange, borderColor: colors.text },
  hero: { flexDirection: "row", alignItems: "center", gap: 16 },
  art: {
    width: 80,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.orange,
  },
  spark: { position: "absolute", right: 0, top: 16 },
});
