import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Search,
  Settings,
} from "lucide-react-native";
import { colors, surfaces } from "@timely/design";
import { useAccount } from "../../src/account";
import { SignIn } from "../../src/sign-in";
import { PlannerProvider } from "../../src/planner-provider";
import { s } from "../../src/ui";
export default function PlannerLayout() {
  const account = useAccount();
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
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: surfaces.border,
            paddingTop: 8,
          },
          tabBarItemStyle: { paddingVertical: 4 },
          tabBarActiveBackgroundColor: surfaces.blue,
          tabBarLabelStyle: { fontFamily: "NunitoSansBold", fontSize: 12 },
          tabBarHideOnKeyboard: true,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Planner",
            tabBarIcon: ({ color, size }) => (
              <CalendarDays color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="review"
          options={{
            title: "Review",
            tabBarIcon: ({ color, size }) => (
              <ChartNoAxesColumnIncreasing color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => (
              <Search color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Settings color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </PlannerProvider>
  );
}
