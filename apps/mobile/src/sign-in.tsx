import { LanguageChoice } from "./language";
import { t, locale, errorMessage, getLanguage } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, surfaces } from "@timely/design";
import { Brand } from "./brand";
import { ProviderLogo } from "./provider-logo";
import { Button } from "./ui";
function Digit({ char }: { char: string }) {
  useLanguage();
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancel = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancel) return;
      if (reduce) {
        motion.setValue(1);
        return;
      }
      motion.setValue(0);
      Animated.timing(motion, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancel = true;
    };
  }, [char, motion]);
  return (
    <Animated.Text
      style={{
        opacity: motion,
        transform: [
          {
            translateY: motion.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
          {
            scale: motion.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 1],
            }),
          },
        ],
        fontFamily: "Baloo2",
        fontSize: 28,
        color: colors.text,
      }}
    >
      {char}
    </Animated.Text>
  );
}
import {
  authClient,
  apiURL,
  isGoogleSignInAvailable,
  signInApple,
  signInGoogle,
} from "./auth";
export function SignIn() {
  useLanguage();
  const googleSignInAvailable = isGoogleSignInAvailable();
  const [providers, setProviders] = useState({ google: false, apple: false });
  const [providerState, setProviderState] = useState("loading");
  const [providerAttempt, setProviderAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    setProviderState("loading");
    void fetch(`${apiURL}/api/v1/auth/providers`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const value = await response.json();
        if (
          typeof value.google !== "boolean" ||
          typeof value.apple !== "boolean"
        )
          throw new Error("Unavailable");
        setProviders({
          google:
            value.google &&
            googleSignInAvailable &&
            !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID &&
            (Platform.OS !== "ios" ||
              !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
          apple: value.apple,
        });
        setProviderState("ready");
      })
      .catch(() => setProviderState("error"))
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [googleSignInAvailable, providerAttempt]);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [shown, setShown] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (otp === shown) return;
    let cancel = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancel) return;
      const jump = otp.length - shown.length;
      if (reduce || jump <= 1 || !otp.startsWith(shown)) {
        setShown(otp);
        return;
      }
      timer = setTimeout(() => setShown(otp.slice(0, shown.length + 1)), 90);
    });
    return () => {
      cancel = true;
      if (timer) clearTimeout(timer);
    };
  }, [otp, shown]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      const code = (
        e as {
          code?: string;
        }
      ).code;
      setMessage(
        code === "ERR_REQUEST_CANCELED"
          ? t("Sign-in cancelled.")
          : e instanceof Error
            ? e.message
            : t("Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }
  async function send(resend = false) {
    const result = await authClient.emailOtp.sendVerificationOtp(
      {
        email,
        type: "sign-in",
      },
      { headers: { "x-timely-language": getLanguage() } },
    );
    if (result.error) throw new Error(result.error.message);
    setSent(true);
    setCooldown(60);
    setOtp("");
    setMessage(resend ? t("A new code is on its way.") : "");
  }
  const action = (
    label: string,
    fn: () => Promise<void>,
    disabled = false,
    variant: "primary" | "ghost" = "primary",
  ) => (
    <Button
      title={label}
      variant={variant}
      disabled={busy || disabled}
      loading={busy && variant === "primary"}
      onPress={() => void run(fn)}
    />
  );
  const availableProviders = (["google", "apple"] as const).filter(
    (provider) => providers[provider],
  );
  const feedback = message ? (
    <Text accessibilityLiveRegion="polite" style={s.caption}>
      {errorMessage(message)}
    </Text>
  ) : null;
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.screen}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Brand />
          <Text accessibilityRole="header" style={s.title}>
            {sent ? t("Enter your code") : t("Make yourself at home.")}
          </Text>
          {sent ? (
            <View style={s.card}>
              <Text style={s.body}>{t("Sent to {v0}", { v0: email })}</Text>
              <Text style={s.label}>{t("Six-digit code")}</Text>
              <View style={s.otpField}>
                <View style={s.otpRow} accessible={false}>
                  {Array.from({ length: 6 }, (_, index) => {
                    const char = shown[index] ?? "";
                    const active = index === Math.min(otp.length, 5);
                    return (
                      <View
                        key={index}
                        style={[
                          s.otpCell,
                          char ? s.otpFilled : null,
                          active ? s.otpActive : null,
                        ]}
                      >
                        {char ? (
                          <Digit key={index + "-" + char} char={char} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                <TextInput
                  accessibilityLabel={t("Six-digit code")}
                  value={otp}
                  onChangeText={(value) =>
                    setOtp(value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  importantForAutofill="yes"
                  autoFocus
                  style={s.otpCapture}
                />
              </View>
              <Text style={s.caption}>{t("Expires in 5 minutes.")}</Text>
              {action(
                "Sign in",
                async () => {
                  const result = await authClient.signIn.emailOtp({
                    email,
                    otp,
                  });
                  if (result.error) throw new Error(result.error.message);
                },
                otp.length !== 6,
              )}
              {feedback}
              <View style={s.secondaryActions}>
                {action(
                  cooldown
                    ? t("Resend in {v0}s", { v0: cooldown })
                    : t("Resend code"),
                  () => send(true),
                  cooldown > 0,
                  "ghost",
                )}
                {action(
                  "Change email",
                  async () => {
                    setSent(false);
                    setOtp("");
                    setMessage("");
                  },
                  false,
                  "ghost",
                )}
              </View>
            </View>
          ) : (
            <View style={s.card}>
              {availableProviders.length > 0 && (
                <>
                  <View style={s.providers}>
                    {availableProviders.map((provider) => (
                      <Button
                        key={provider}
                        title={t("Continue with {v0}", {
                          v0: provider === "google" ? "Google" : "Apple",
                        })}
                        disabled={busy}
                        onPress={() =>
                          void run(
                            provider === "google" ? signInGoogle : signInApple,
                          )
                        }
                      >
                        <ProviderLogo provider={provider} />
                      </Button>
                    ))}
                  </View>
                  <View style={s.dividerRow}>
                    <View style={s.line} />
                    <Text style={s.caption}>{t("or")}</Text>
                    <View style={s.line} />
                  </View>
                </>
              )}
              <Text style={s.label}>{t("Email address")}</Text>
              <TextInput
                accessibilityLabel={t("Email address")}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                style={s.input}
              />
              {action("Send me a code", () => send())}
              {feedback}
              {providerState === "error" && (
                <>
                  <Text style={s.caption}>
                    {t("Other sign-in options are unavailable.")}
                  </Text>
                  <Button
                    title={t("Retry other options")}
                    variant="ghost"
                    disabled={busy}
                    onPress={() => setProviderAttempt((value) => value + 1)}
                  />
                </>
              )}
            </View>
          )}
          <LanguageChoice />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  providers: { gap: 12 },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  caption: {
    fontFamily: "NunitoSans",
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  line: { flex: 1, height: 1, backgroundColor: surfaces.border },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 24 },
  title: {
    fontFamily: "Baloo2",
    color: colors.text,
    fontSize: 32,
    lineHeight: 40,
  },
  body: { fontFamily: "NunitoSans", fontSize: 16, color: colors.muted },
  label: { fontFamily: "NunitoSans", color: colors.text, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 12,
    padding: 12,
    fontFamily: "NunitoSans",
    fontSize: 16,
    color: colors.text,
  },
  otpField: { position: "relative" },
  otpRow: { flexDirection: "row", gap: 8 },
  otpCell: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  otpFilled: { borderColor: colors.primary, backgroundColor: "#f3f7ff" },
  otpActive: { borderColor: colors.primary },
  otpCapture: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: "transparent",
    fontSize: 16,
  },
});
