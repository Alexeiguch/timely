import { LanguageRoot } from "../src/language";
import { t, locale } from "@timely/i18n";
import { useLanguage } from "../src/language-state";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Baloo2_700Bold } from "@expo-google-fonts/baloo-2/700Bold";
import { NunitoSans_400Regular } from "@expo-google-fonts/nunito-sans/400Regular";
import { NunitoSans_700Bold } from "@expo-google-fonts/nunito-sans/700Bold";
import { Text, View } from "react-native";
import { colors } from "@timely/design";
import { AccountProvider } from "../src/account";
import { Button, s } from "../src/ui";
void SplashScreen.preventAutoHideAsync();
export default function Layout() {
  useLanguage();
  const [loaded, error] = useFonts({
    Baloo2: Baloo2_700Bold,
    NunitoSans: NunitoSans_400Regular,
    NunitoSansBold: NunitoSans_700Bold,
  });
  useEffect(() => {
    if (loaded || error) SplashScreen.hide();
  }, [loaded, error]);
  if (!loaded && !error)
    return (
      <View style={[s.screen, s.page]}>
        <Text>{t("Opening your day\u2026")}</Text>
      </View>
    );
  return (
    <LanguageRoot>
      <SafeAreaProvider>
        <AccountProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
          </Stack>
        </AccountProvider>
      </SafeAreaProvider>
    </LanguageRoot>
  );
}
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  useLanguage();
  return (
    <View style={[s.screen, s.page, s.center]}>
      <Text style={s.heading}>{t("Let\u2019s try that again.")}</Text>
      <Text style={s.body}>
        {t("Your saved plans are still on this device.")}
      </Text>
      <Button title={t("Reopen planner")} active onPress={retry} />
    </View>
  );
}
