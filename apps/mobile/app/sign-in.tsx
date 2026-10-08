import { t } from "@timely/i18n";
import { useLanguage } from "../src/language-state";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { SignIn } from "../src/sign-in";
import { authClient } from "../src/auth";
import { Button, s } from "../src/ui";
export default function Reauthenticate() {
  useLanguage();
  const { data: session } = authClient.useSession();
  const firstSession = useRef(session?.session.id);
  useEffect(() => {
    if (session && session.session.id !== firstSession.current)
      router.replace("/");
  }, [session]);
  return (
    <View style={s.screen}>
      <Button
        title={t("Back to saved plans")}
        onPress={() => router.replace("/")}
      />
      <SignIn />
    </View>
  );
}
