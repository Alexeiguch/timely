import { expect, it, vi } from "vitest";
import { expoPush } from "../apps/web/server/expo-push";
it("uses silent normal-priority push and a separate quiet channel for summaries", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ data: { status: "ok", id: "synthetic-ticket" } }),
        { status: 200 },
      ),
    );
  const result = await expoPush(fetcher).send({
    to: "ExpoPushToken[synthetic-digest]",
    title: "Daily summary",
    body: "One plan",
    data: { kind: "summary" },
    expiration: 1800000000,
    collapseId: "summary-key",
    silent: true,
  });
  expect(result.status).toBe("ticket");
  const body = JSON.parse(String(fetcher.mock.calls[0]![1]!.body));
  expect(body).toMatchObject({
    sound: null,
    priority: "normal",
    channelId: "daily-summary",
  });
  expect(body).not.toHaveProperty("silent");
});
