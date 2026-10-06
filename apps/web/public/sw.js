// Only the public client shell, app icons and immutable build assets enter the cache.
// Auth/API responses, RSC requests, task content and other navigation paths never do.
const CACHE = "timely-public-shell-v3";
const icon = (url) => ["/favicon.ico", "/icon.svg"].includes(url.pathname);
const asset = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") || icon(url));
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const response = await fetch("/", {
        credentials: "omit",
        cache: "reload",
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("text/html")
      )
        throw new Error("Public shell unavailable");
      await cache.put("/", response);
      await Promise.all(
        ["/favicon.ico", "/icon.svg"].map(async (path) => {
          const response = await fetch(path, {
            credentials: "omit",
            cache: "reload",
          });
          if (response.ok) await cache.put(path, response);
        }),
      );
      await self.skipWaiting();
    }),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith("timely-public-shell-") && key !== CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
    ]),
  );
});
self.addEventListener("message", (event) => {
  if (
    event.data?.type !== "CACHE_PUBLIC_ASSETS" ||
    !Array.isArray(event.data.urls)
  )
    return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        event.data.urls
          .filter((value) => {
            try {
              return asset(new URL(value));
            } catch {
              return false;
            }
          })
          .map(async (url) => {
            const response = await fetch(url, { credentials: "omit" });
            if (response.ok) await cache.put(url, response);
          }),
      ),
    ),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (asset(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request, { ignoreSearch: icon(url) });
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
  } else if (
    request.mode === "navigate" &&
    url.pathname === "/"
  ) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const response = await fetch("/", {
            credentials: "omit",
            cache: "no-cache",
          });
          if (
            response.ok &&
            response.headers.get("content-type")?.includes("text/html")
          )
            await cache.put("/", response.clone());
          return response;
        } catch {
          return (await cache.match("/")) ?? Response.error();
        }
      }),
    );
  }
});
