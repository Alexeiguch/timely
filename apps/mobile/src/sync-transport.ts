import { httpTransport } from "@timely/sync";

/** Task synchronization uses only the planner API, independently of push registration. */
export function nativeSyncTransport(ownerId: string, fetcher: Parameters<typeof httpTransport>[0]) {
  return httpTransport((path, init) =>
    fetcher(path, {
      ...init,
      headers: { ...init?.headers, "X-Timely-Account": ownerId },
    }),
  );
}
