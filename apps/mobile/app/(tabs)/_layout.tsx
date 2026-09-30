import { Tabs } from "expo-router";
import { Text, View, StyleSheet, useWindowDimensions } from "react-native";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Search,
  Settings,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, surfaces, radius } from "@timely/design";
import { useAccount } from "../../src/account";
import { SignIn } from "../../src/sign-in";
import { PlannerProvider } from "../../src/planner-provider";
import { s } from "../../src/ui";
export default function PlannerLayout() {
  const account = useAccount();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  if (!account.ready)
    return (
      <View style={[s.screen, s.page]}>
        <Text style={s.body}>Opening your day…</Text>
      </View>
    );
  if (!account.identity)
    return (
      <View style={s.screen}>
        {!!account.error && (
          <Text style={[s.body, s.error]}>{account.error}</Text>
        )}
        <SignIn />
      </View>
    );
  return (
    <PlannerProvider key={account.identity.id} ownerId={account.identity.id}>
      <Tabs
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: [
            styles.dock,
            {
              height: 76 + Math.max(0, fontScale - 1) * 20,
              marginBottom: Math.max(insets.bottom, 12),
            },
          ],
          tabBarItemStyle: styles.item,
          tabBarLabelPosition: "below-icon",
          tabBarLabelStyle: styles.label,
          tabBarIconStyle: styles.iconSlot,
          tabBarHideOnKeyboard: true,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Planner",
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.icon, focused && styles.selectedIcon]}>
                <CalendarDays
                  color={focused ? colors.surface : color}
                  size={23}
                  strokeWidth={focused ? 2.3 : 1.8}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="review"
          options={{
            title: "Review",
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.icon, focused && styles.selectedIcon]}>
                <ChartNoAxesColumnIncreasing
                  color={focused ? colors.surface : color}
                  size={23}
                  strokeWidth={focused ? 2.3 : 1.8}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.icon, focused && styles.selectedIcon]}>
                <Search
                  color={focused ? colors.surface : color}
                  size={23}
                  strokeWidth={focused ? 2.3 : 1.8}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.icon, focused && styles.selectedIcon]}>
                <Settings
                  color={focused ? colors.surface : color}
                  size={23}
                  strokeWidth={focused ? 2.3 : 1.8}
                />
              </View>
            ),
          }}
        />
      </Tabs>
    </PlannerProvider>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: surfaces.border,
    borderRadius: radius.container,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  item: { borderRadius: radius.card, paddingVertical: 0 },
  label: { fontFamily: "NunitoSansBold", fontSize: 12, marginTop: 4 },
  iconSlot: { width: 56, height: 32 },
  icon: {
    width: 56,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedIcon: { backgroundColor: colors.primary },
});
