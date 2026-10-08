import { getLanguage, t } from "@timely/i18n";
import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { NotificationAdapter } from "@timely/sync";
import { apiURL } from "./auth";
import {
  pendingNotificationCleanup,
  finishNotificationCleanup,
} from "./local-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export async function notificationPermission() {
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ? ("granted" as const)
    : permission.canAskAgain
      ? ("undetermined" as const)
      : ("denied" as const);
}
export async function requestReminderPermission() {
  if ((await notificationPermission()) !== "undetermined") return;
  const accepted = await new Promise<boolean>((resolve) =>
    Alert.alert(
      t("Reminders for your plans"),
      t(
        "Allow Timely to notify you before a task and when it becomes overdue. You can change this in Settings.",
      ),
      [
        { text: t("Later"), style: "cancel", onPress: () => resolve(false) },
        { text: t("Continue"), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
  if (!accepted) return;
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("plans", {
      name: t("Task reminders"),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  await Notifications.requestPermissionsAsync();
}
export const notificationAdapter: NotificationAdapter = {
  permission: notificationPermission,
  async scheduled() {
    const entries = await Notifications.getAllScheduledNotificationsAsync();
    const current = [];
    for (const entry of entries) {
      const data = entry.content.data ?? {};
      const owned =
        data?.environment === apiURL &&
        typeof data.key === "string" &&
        typeof data.ownerId === "string" &&
        typeof data.due === "number"
          ? {
              nativeId: entry.identifier,
              key: data.key,
              ownerId: data.ownerId,
              due: data.due,
            }
          : null;
      if (!owned) continue;
      if (data.language !== getLanguage())
        await Notifications.cancelScheduledNotificationAsync(entry.identifier);
      else current.push(owned);
    }
    return current;
  },
  cancel: Notifications.cancelScheduledNotificationAsync,
  async schedule(key, item, plan, ownerId) {
    return Notifications.scheduleNotificationAsync({
      identifier: `timely:${key}`,
      content: {
        title: item.title,
        body:
          plan.kind === "before"
            ? item.schedule.time
              ? t("Coming up at {v0}", { v0: item.schedule.time })
              : t("Coming up today")
            : t("Still on your mind"),
        sound: "default",
        data: {
          key,
          language: getLanguage(),
          environment: apiURL,
          ownerId,
          occurrenceId: item.id,
          day: item.schedule.date,
          kind: plan.kind,
          version: plan.version,
          due: plan.due,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Math.max(plan.due, Date.now() + 1000)),
        channelId: "plans",
      },
    });
  },
};
export async function flushNotificationCleanup() {
  for (const ownerId of await pendingNotificationCleanup()) {
    for (const entry of await notificationAdapter.scheduled())
      if (entry.ownerId === ownerId)
        await notificationAdapter.cancel(entry.nativeId);
    await finishNotificationCleanup(ownerId);
  }
}
