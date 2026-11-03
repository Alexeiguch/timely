import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  colors,
  nativeTypography as type,
  radius,
  surfaces,
} from "@timely/design";
import { errorMessage, getLanguage, t } from "@timely/i18n";
import { useLanguage } from "./language-state";
import { LanguageChoice } from "./language";
import { PublicLinks } from "./public-links";
import { Brand } from "./brand";
import { ProviderLogo } from "./provider-logo";
import { Button } from "./ui";
import {
  apiURL,
  authClient,
  isGoogleSignInAvailable,
  signInApple,
  signInGoogle,
} from "./auth";

type Action = "apple" | "google" | "send" | "verify" | "resend";

export function SignIn() {
  useLanguage();
  const googleSignInAvailable = isGoogleSignInAvailable();
  const [providers, setProviders] = useState({ google: false, apple: false });
  const [providerState, setProviderState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [providerAttempt, setProviderAttempt] = useState(0);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const running = useRef(false);
  const busy = pending !== null;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let active = true;
    setProviderState("loading");
    setProviders({ google: false, apple: false });
    void Promise.all([
      fetch(`${apiURL}/api/v1/auth/providers`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const value: unknown = await response.json();
        if (
          !value ||
          typeof value !== "object" ||
          !("google" in value) ||
          typeof value.google !== "boolean" ||
          !("apple" in value) ||
          typeof value.apple !== "boolean" ||
          ("appleNative" in value && typeof value.appleNative !== "boolean")
        ) {
          throw new Error("Unavailable");
        }
        return {
          google: value.google,
          apple: value.apple,
          appleNative:
            "appleNative" in value && typeof value.appleNative === "boolean"
              ? value.appleNative
              : undefined,
        };
      }),
      Platform.OS === "ios"
        ? AppleAuthentication.isAvailableAsync().catch(() => false)
        : Promise.resolve(true),
    ])
      .then(([value, appleAvailable]) => {
        if (!active) return;
        setProviders({
          google:
            value.google &&
            googleSignInAvailable &&
            !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID &&
            (Platform.OS !== "ios" ||
              !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
          apple:
            appleAvailable &&
            (Platform.OS === "ios" && value.appleNative !== undefined
              ? value.appleNative
              : value.apple),
        });
        setProviderState("ready");
      })
      .catch(() => {
        if (active) setProviderState("error");
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [googleSignInAvailable, providerAttempt]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function run(action: Action, work: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setPending(action);
    setMessage("");
    setFailed(false);
    try {
      await work();
    } catch (error) {
      // Dismissing a provider sheet leaves the sign-in form ready to use.
      if (
        (error as { code?: string } | null)?.code !== "ERR_REQUEST_CANCELED"
      ) {
        setFailed(true);
        setMessage(
          error instanceof Error &&
            /network|fetch|offline|connection/i.test(error.message)
            ? t("Could not connect. Check your internet connection.")
            : errorMessage(error, "Could not sign in. Please try again."),
        );
      }
    } finally {
      running.current = false;
      setPending(null);
    }
  }

  async function send(resend = false) {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      throw new Error("Enter a valid email address.");
    }
    const result = await authClient.emailOtp.sendVerificationOtp(
      { email: address, type: "sign-in" },
      { headers: { "x-timely-language": getLanguage() } },
    );
    if (result.error) throw new Error(result.error.message);
    setEmail(address);
    setSent(true);
    setCooldown(60);
    setOtp("");
    setMessage(resend ? t("Code sent.") : "");
  }

  async function verify() {
    const result = await authClient.signIn.emailOtp({ email, otp });
    if (result.error) throw new Error(result.error.message);
  }

  const feedback = message ? (
    <Text
      accessibilityRole={failed ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[s.caption, failed && s.error]}
    >
      {errorMessage(message)}
    </Text>
  ) : null;

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.screen}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={s.brand}>
            <Brand large />
          </View>
          <View style={s.form}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={s.title}>
              {sent ? t("Enter your code") : t("Sign in")}
            </Text>
            {sent ? (
              <>
                <Text style={s.body}>{t("Sent to {v0}", { v0: email })}</Text>
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
                  editable={!busy}
                  style={[s.input, s.code]}
                />
                <Text style={s.caption}>{t("Expires in 5 minutes.")}</Text>
                {feedback}
                <Button
                  title={t("Sign in")}
                  variant="primary"
                  disabled={busy || otp.length !== 6}
                  loading={pending === "verify"}
                  onPress={() => void run("verify", verify)}
                />
                <View style={s.secondaryActions}>
                  <Button
                    title={
                      cooldown
                        ? t("Resend in {v0}s", { v0: cooldown })
                        : t("Resend code")
                    }
                    variant="ghost"
                    disabled={busy || cooldown > 0}
                    loading={pending === "resend"}
                    onPress={() => void run("resend", () => send(true))}
                  />
                  <Button
                    title={t("Change email")}
                    variant="ghost"
                    disabled={busy}
                    onPress={() => {
                      setSent(false);
                      setOtp("");
                      setMessage("");
                    }}
                  />
                </View>
              </>
            ) : (
              <>
                {(providers.apple || providers.google) && (
                  <>
                    <View style={s.providers}>
                      {providers.apple &&
                        (Platform.OS === "ios" ? (
                          <View
                            pointerEvents={busy ? "none" : "auto"}
                            accessibilityState={{
                              disabled: busy,
                              busy: pending === "apple",
                            }}
                          >
                            <AppleAuthentication.AppleAuthenticationButton
                              buttonType={
                                AppleAuthentication
                                  .AppleAuthenticationButtonType.CONTINUE
                              }
                              buttonStyle={
                                AppleAuthentication
                                  .AppleAuthenticationButtonStyle.BLACK
                              }
                              cornerRadius={radius.medium}
                              style={s.appleButton}
                              onPress={() => void run("apple", signInApple)}
                            />
                            {pending === "apple" && (
                              <View pointerEvents="none" style={s.appleLoading}>
                                <ActivityIndicator color={colors.surface} />
                              </View>
                            )}
                          </View>
                        ) : (
                          <Button
                            title={t("Continue with Apple")}
                            disabled={busy}
                            loading={pending === "apple"}
                            onPress={() => void run("apple", signInApple)}
                          >
                            <ProviderLogo provider="apple" />
                          </Button>
                        ))}
                      {providers.google && (
                        <Button
                          title={t("Continue with Google")}
                          disabled={busy}
                          loading={pending === "google"}
                          onPress={() => void run("google", signInGoogle)}
                        >
                          <ProviderLogo provider="google" />
                        </Button>
                      )}
                    </View>
                    <View style={s.dividerRow}>
                      <View style={s.line} />
                      <Text style={s.caption}>{t("or")}</Text>
                      <View style={s.line} />
                    </View>
                  </>
                )}
                <View style={s.field}>
                  <Text style={s.label}>{t("Email address")}</Text>
                  <TextInput
                    accessibilityLabel={t("Email address")}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    editable={!busy}
                    returnKeyType="go"
                    onSubmitEditing={() => void run("send", () => send())}
                    style={s.input}
                  />
                </View>
                {feedback}
                <Button
                  title={t("Send code")}
                  variant="primary"
                  disabled={busy || !email.trim()}
                  loading={pending === "send"}
                  onPress={() => void run("send", () => send())}
                />
                {providerState === "error" && (
                  <Button
                    title={t("Retry sign-in options")}
                    variant="ghost"
                    disabled={busy}
                    onPress={() => setProviderAttempt((value) => value + 1)}
                  />
                )}
              </>
            )}
          </View>
          <View style={s.footer}>
            <LanguageChoice compact />
            <PublicLinks />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 16,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  brand: { alignItems: "center", paddingTop: 24, paddingBottom: 32 },
  form: { gap: 16 },
  title: { ...type.heading, color: colors.text, marginBottom: 8 },
  body: { ...type.body, color: colors.text },
  label: { ...type.label, color: colors.text },
  caption: { ...type.caption, color: colors.muted },
  error: { color: surfaces.danger },
  field: { gap: 8 },
  input: {
    ...type.body,
    minHeight: 56,
    borderWidth: 1,
    borderColor: surfaces.inputBorder,
    borderRadius: radius.small,
    padding: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  code: {
    fontFamily: "NunitoSansBold",
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 8,
    textAlign: "center",
  },
  providers: { gap: 12 },
  appleButton: { width: "100%", height: 52 },
  appleLoading: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: surfaces.inputBorder,
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  footer: { marginTop: "auto", paddingTop: 32, gap: 8 },
});
