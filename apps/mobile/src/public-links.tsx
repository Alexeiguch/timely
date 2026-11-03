import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "@timely/i18n";
import { colors } from "@timely/design";
import { apiURL } from "./auth";
import { useLanguage } from "./language-state";
const links = [
  ["privacy", "Privacy policy"],
  ["support", "Support"],
  ["delete-account", "Account deletion"],
] as const;
export function PublicLinks() {
  useLanguage();
  return <View style={styles.links}>
    {links.map(([path, label]) => <Pressable
      key={path}
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(`${apiURL}/${path}`).catch(() =>
          Alert.alert(t("Help & privacy"), t("Could not open this page. Please try again.")),
        );
      }}
      style={styles.link}
    ><Text style={styles.text}>{t(label)}</Text></Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  link: { minHeight: 48, justifyContent: "center", padding: 12 },
  text: { color: colors.primary, fontFamily: "NunitoSans", fontSize: 16, textDecorationLine: "underline" },
});
