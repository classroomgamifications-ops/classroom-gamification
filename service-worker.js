// service-worker.js - Cache offline e sincronização
const CACHE_NAME = "classroom-v1";
const urlsParaCache = [
  "/",
  "/index.html",
  "/app.js",
  "/sdk-sync.js",
  "/style.css",
  "/manifest.json"
];

// Instalação
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsParaCache);
    })
  );
  self.skipWaiting();
});

// Ativação
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch (Network-first, fall back to cache)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          return response || new Response("Offline");
        });
      })
  );
});

// Background Sync (sincroniza quando volta online)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-classroom") {
    event.waitUntil(
      fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
  }
});
