import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@timely/design";
export function Brand() {
  return (
    <View style={styles.brand} accessible accessibilityLabel="Timely">
      <Text style={styles.word}>timely</Text>
      <View style={styles.mark}>
        <Image
          source={require("../assets/icon.png")}
          style={styles.logo}
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
