import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@timely/design";
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <View
      style={[styles.brand, large && styles.largeBrand]}
      accessible
      accessibilityLabel="Timely"
    >
      <Text style={[styles.word, large && styles.largeWord]}>timely</Text>
      <View style={[styles.mark, large && styles.largeMark]}>
        <Image
          source={require("../assets/icon.png")}
          style={[styles.logo, large && styles.largeLogo]}
          accessible={false}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  word: { fontFamily: "Baloo2", fontSize: 28, color: colors.primary },
  logo: { width: 28, height: 28 },
  largeBrand: { gap: 12, flexWrap: "wrap", maxWidth: "100%" },
  largeWord: { fontSize: 56 },
  largeLogo: { width: 56, height: 56 },
  largeMark: { width: 56, height: 56, borderRadius: 28 },
  mark: {
    overflow: "hidden",
    width: 28,
    height: 28,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
});
