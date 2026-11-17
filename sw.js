const CACHE_NAME = "a-share-learning-v6-20261117";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.svg"
].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const [home, index, ...staticFiles] = APP_SHELL;
    const response = await fetch(index, { cache: "reload" });
    if (!response.ok) throw new Error("Unable to cache the app index");
    const html = await response.clone().text();
    // Vite emits the content-hashed entry script and stylesheet into index.html.
    const entries = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+\.(?:js|css))"/g)]
      .map(([, path]) => new URL(path, index).href);
    if (!entries.length) throw new Error("No generated app assets found");
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...staticFiles, ...entries]);
    await cache.put(home, response.clone());
    await cache.put(index, response);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("a-share-learning-") && key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.registration.scope)) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_SHELL[1], response.clone()).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(APP_SHELL[1]).then((cached) => cached ?? Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone()).catch(() => undefined);
        }
        return response;
      }).catch(() => Response.error());
    })
  );
});
