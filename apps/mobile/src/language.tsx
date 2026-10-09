import type { ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Text, View } from "react-native";
import { languageStorageKey, setLanguage, t } from "@timely/i18n";
import {
  LanguageProvider,
  useLanguage,
  useLanguagePersistence,
  type LanguageStorage,
} from "./language-state";
import { Button, s } from "./ui";
const storage: LanguageStorage = {
  read: () => SecureStore.getItemAsync(languageStorageKey),
  write: (language) => SecureStore.setItemAsync(languageStorageKey, language),
};
export function LanguageRoot({ children }: { children: ReactNode }) {
  return <LanguageProvider storage={storage}>{children}</LanguageProvider>;
}
export function LanguageChoice() {
  const language = useLanguage();
  const { error } = useLanguagePersistence();
  return (
    <View style={s.field}>
      <Text style={s.label}>{t("Language")}</Text>
      <View style={s.row}>
        <Button
          title="Español"
          label="Español"
          active={language === "es"}
          onPress={() => setLanguage("es")}
        />
        <Button
          title="English"
          label="English"
          active={language === "en"}
          onPress={() => setLanguage("en")}
        />
      </View>
      {error && (
        <Text accessibilityLiveRegion="polite" style={s.muted}>
          {t("Language changed for now. Could not save it on this device.")}
        </Text>
      )}
    </View>
  );
}
