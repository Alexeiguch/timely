import { Stack, type ErrorBoundaryProps } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Baloo2_700Bold } from "@expo-google-fonts/baloo-2/700Bold";
import { NunitoSans_400Regular } from "@expo-google-fonts/nunito-sans/400Regular";
import { NunitoSans_700Bold } from "@expo-google-fonts/nunito-sans/700Bold";
import { Text, View } from "react-native";
import { colors } from "@timely/design";
import { AccountProvider } from "../src/account";
import { Button, s } from "../src/ui";
export default function Layout() {
  const [loaded, error] = useFonts({
    Baloo2: Baloo2_700Bold,
    NunitoSans: NunitoSans_400Regular,
    NunitoSansBold: NunitoSans_700Bold,
  });
  if (!loaded && !error)
    return (
      <View style={[s.screen, s.page]}>
        <Text>Opening your day…</Text>
      </View>
    );
  return (
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
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={[s.screen, s.page, s.center]}>
      <Text style={s.heading}>Let’s try that again.</Text>
      <Text style={s.body}>Your saved plans are still on this device.</Text>
      <Button title="Reopen planner" active onPress={retry} />
    </View>
  );
}
