import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  View,
  Text,
  TextInput,
  Pressable,
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
      const code = (e as { code?: string }).code;
      setMessage(
        code === "ERR_REQUEST_CANCELED"
          ? "Sign-in cancelled."
          : e instanceof Error
            ? e.message
            : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function send(resend = false) {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (result.error) throw new Error(result.error.message);
    setSent(true);
    setCooldown(60);
    setOtp("");
    setMessage(resend ? "A new code is on its way." : "");
  }
  const action = (label: string, fn: () => Promise<void>, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      accessibilityState={{ disabled: busy || disabled, busy }}
      style={({ pressed }) => [s.button, pressed && { opacity: 0.8 }]}
      onPress={() => run(fn)}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.screen}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          {sent ? (
            <>
              <Brand />
              <View style={s.intro}>
                <Text style={s.title}>Enter your code.</Text>
                <Text style={s.body}>
                  We sent six digits to {email}. They expire in 5 minutes.
                </Text>
              </View>
              <View style={s.card}>
                <Text style={s.heading}>One code, then you’re in</Text>
                <Text style={s.body}>
                  We sent six digits to {email}. They expire in 5 minutes.
                  Type them here, or accept the code suggested from your email.
                </Text>
                <Text style={s.label}>Six-digit code</Text>
                <View style={s.otpField}>
                  <View style={s.otpRow}>
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
                            <Digit key={`${index}-${char}`} char={char} />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                  <TextInput
                    accessibilityLabel="Six-digit code"
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
                <Text style={s.caption}>One number in each box.</Text>
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
                {action(
                  cooldown ? `Resend in ${cooldown}s` : "Resend code",
                  () => send(true),
                  cooldown > 0,
                )}
                {action("Change email", async () => {
                  setSent(false);
                  setOtp("");
                  setMessage("");
                })}
                <Text accessibilityLiveRegion="polite" style={s.caption}>
                  {busy ? "Just a moment…" : message}
                </Text>
              </View>
            </>
          ) : (
            <>
          <Brand />
          <View style={s.intro}>
            <Text style={s.title}>Make room for what matters.</Text>
            <Text style={s.body}>
              Your plans, at your pace. All in one little place.
            </Text>
          </View>
          <View style={s.card}>
            <Text style={s.heading}>Welcome to your day</Text>
            <Text style={s.body}>Sign in to keep your plans together.</Text>
            <View style={s.providers}>
              {(["google", "apple"] as const).map((provider) => (
                <Button
                  key={provider}
                  title={`Continue with ${provider === "google" ? "Google" : "Apple"}`}
                  disabled={busy || !providers[provider]}
                  onPress={() =>
                    void run(provider === "google" ? signInGoogle : signInApple)
                  }
                >
                  <ProviderLogo provider={provider} />
                </Button>
              ))}
            </View>
            {(providerState !== "ready" ||
              !providers.google ||
              !providers.apple) && (
              <Text style={s.caption}>
                {providerState === "loading"
                  ? "Checking sign-in options…"
                  : providerState === "error"
                    ? "Social sign-in is unavailable right now. You can use email."
                    : !googleSignInAvailable
                      ? "Google sign-in requires a fresh Timely development build and is not available in Expo Go. Email is ready to use."
                    : "Some sign-in options aren’t available on this build. Email is ready to use."}
              </Text>
            )}
            {providerState === "error" && (
              <Button
                title="Retry sign-in options"
                variant="ghost"
                onPress={() => setProviderAttempt((value) => value + 1)}
              />
            )}
            <View style={s.dividerRow}>
              <View style={s.line} />
              <Text style={s.caption}>or use your email</Text>
              <View style={s.line} />
            </View>
            <Text style={s.label}>Email address</Text>
            <TextInput
              accessibilityLabel="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              style={s.input}
            />
            {action("Send me a code", () => send())}
            <Text accessibilityLiveRegion="polite" style={s.caption}>
              {busy ? "Just a moment…" : message}
            </Text>
          </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  intro: { gap: 8 },
  providers: { gap: 12, paddingTop: 8 },
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
  content: { padding: 20, gap: 24, paddingBottom: 32 },
  logo: { fontFamily: "Baloo2", color: colors.primary, fontSize: 36 },
  title: {
    fontFamily: "Baloo2",
    color: colors.text,
    fontSize: 34,
    lineHeight: 42,
  },
  heading: { fontFamily: "Baloo2", fontSize: 24, color: colors.text },
  body: { fontFamily: "NunitoSans", fontSize: 16, color: colors.muted },
  label: { fontFamily: "NunitoSans", color: colors.text, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
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
    height: 56,
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
  button: {
    minHeight: 48,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  buttonText: {
    color: colors.surface,
    fontFamily: "NunitoSansBold",
    fontSize: 16,
  },
});
