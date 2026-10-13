import { getLanguage, t } from "@timely/i18n";
import { Alert, AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { NotificationAdapter } from "@timely/sync";
import { DailySummary } from "@timely/domain";
import { apiURL } from "./auth";
import {
  pendingNotificationCleanup,
  finishNotificationCleanup,
} from "./local-store";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner:
      notification.request.content.data?.kind !== "summary" ||
      AppState.currentState !== "active",
    shouldShowList: true,
    shouldPlaySound: notification.request.content.data?.kind !== "summary",
    shouldSetBadge: false,
  }),
});
class NativeNotifications {
  static async summaryChannel() {
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("daily-summary", {
        name: t("Daily summary"),
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
      });
  }
  static async permission() {
    const permission = await Notifications.getPermissionsAsync();
    return permission.granted ||
      permission.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL
      ? ("granted" as const)
      : permission.canAskAgain
        ? ("undetermined" as const)
        : ("denied" as const);
  }
  static async requestPermission() {
    if ((await NativeNotifications.permission()) !== "undetermined") return;
    const accepted = await new Promise<boolean>((resolve) =>
      Alert.alert(
        t("Reminders for your plans"),
        t(
          "Allow Timely to send the reminders you choose. A daily summary is quiet; individual task reminders are optional.",
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
  static async flushCleanup() {
    for (const ownerId of await pendingNotificationCleanup()) {
      for (const entry of await notificationAdapter.scheduled())
        if (entry.ownerId === ownerId)
          await notificationAdapter.cancel(entry.nativeId);
      await finishNotificationCleanup(ownerId);
    }
  }
}
export const notificationPermission = NativeNotifications.permission;
export const requestReminderPermission = NativeNotifications.requestPermission;
export const flushNotificationCleanup = NativeNotifications.flushCleanup;
export const configureSummaryChannel = NativeNotifications.summaryChannel;
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
              ...(typeof data.summaryCount === "number"
                ? { summaryCount: data.summaryCount }
                : {}),
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
    const summary = plan.kind === "summary";
    if (!summary && !item)
      throw new Error("A task reminder needs its occurrence.");
    if (summary) await NativeNotifications.summaryChannel();
    const message = summary ? DailySummary.message(plan.count) : null;
    return Notifications.scheduleNotificationAsync({
      identifier: `timely:${key}`,
      content: {
        title: summary ? t("Timely · Your daily summary") : item!.title,
        body: message
          ? t(message.message, message.parameters)
          : plan.kind === "before"
            ? item!.schedule.time
              ? t("Coming up at {v0}", { v0: item!.schedule.time })
              : t("Coming up today")
            : t("Still on your mind"),
        ...(summary ? {} : { sound: "default" }),
        data: {
          key,
          language: getLanguage(),
          environment: apiURL,
          ownerId,
          occurrenceId: plan.occurrenceId,
          day: summary ? plan.day : item!.schedule.date,
          ...(summary ? { summaryCount: plan.count } : {}),
          kind: plan.kind,
          version: plan.version,
          due: plan.due,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Math.max(plan.due, Date.now() + 1000)),
        channelId: summary ? "daily-summary" : "plans",
      },
    });
  },
};
