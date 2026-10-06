import { historyRequestSchema, historyResponseSchema, type HistoryRequest } from "@timely/contracts";
import { SyncError } from "./engine";
export async function loadHistory(fetcher: (path: string, init?: RequestInit) => Promise<Response>, ownerId: string, input: HistoryRequest) {
  const request = historyRequestSchema.parse(input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request)) {
    if (value !== undefined) params.set(key, key === "cursor" ? JSON.stringify(value) : String(value));
  }
  const response = await fetcher(`/api/v1/history?${params}`, { cache: "no-store", headers: { "X-Timely-Account": ownerId }, signal: AbortSignal.timeout(20000) });
  const value = await response.json();
  if (!response.ok) throw new SyncError(response.status, value.code, value.message ?? "History is unavailable. Your downloaded plans are still available.");
  return historyResponseSchema.parse(value);
}
