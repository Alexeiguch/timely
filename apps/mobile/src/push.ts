import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getLanguage } from "@timely/i18n";
import {
  httpTransport,
  type ReminderCoverageAdapter,
  type LocalState,
} from "@timely/sync";
import { apiURL, authenticatedFetch } from "./auth";
import { notificationPermission } from "./notifications";
async function bounded<T>(work: Promise<T>, timeoutMs = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Push registration unavailable")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function timedFetch(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await authenticatedFetch(path, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
let cachedToken: { projectId: string; token: string } | undefined;
export function invalidatePushToken() {
  cachedToken = undefined;
}
export function createPushCoverage(): ReminderCoverageAdapter {
  const request = (state: LocalState, path: string, body: unknown) =>
    httpTransport((url, init) =>
      timedFetch(url, {
        ...init,
        headers: { ...init?.headers, "X-Timely-Account": state.ownerId },
      }),
    )(path, body);
  return {
    async prepare(state, entries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${apiURL}/api/v1/notifications/config`, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      if (response.status === 404) return { available: false, blocked: [] };
      if (!response.ok) throw new Error("Push configuration unavailable");
      const config: { enabled?: boolean; projectId?: string } =
        await response.json();
      const projectId: unknown =
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId;
      if (
        !config.enabled ||
        typeof projectId !== "string" ||
        config.projectId !== projectId
      )
        return { available: false, blocked: [] };
      const permission = await notificationPermission();
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("plans", {
          name:
            getLanguage() === "es"
              ? "Recordatorios de tareas"
              : "Task reminders",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      let token: string | null = null;
      if (permission === "granted") {
        if (!cachedToken || cachedToken.projectId !== projectId)
          cachedToken = {
            projectId,
            token: (
              await bounded(Notifications.getExpoPushTokenAsync({ projectId }))
            ).data,
          };
        token = cachedToken.token;
      }
      await request(state, "devices/register", {
        id: state.deviceId,
        platform: Platform.OS,
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        protocolVersion: 1,
      });
      const result = (await request(state, "notifications/prepare", {
        deviceId: state.deviceId,
        projectId,
        token,
        platform: Platform.OS,
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: getLanguage(),
        permission,
        keys: entries.map((entry) => entry.key),
      })) as { blocked: string[] };
      return { available: true, blocked: result.blocked };
    },
    async commit(state, entries, handled) {
      return (await request(state, "notifications/coverage", {
        deviceId: state.deviceId,
        cursor: state.cursor,
        entries,
        handled,
      })) as { ready: boolean; retry: boolean };
    },
  };
}
export async function sendPushTest(state: LocalState) {
  await httpTransport((url, init) =>
    timedFetch(url, {
      ...init,
      headers: { ...init?.headers, "X-Timely-Account": state.ownerId },
    }),
  )("notifications/test", { deviceId: state.deviceId });
}
