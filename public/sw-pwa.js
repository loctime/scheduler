// Service Worker único para el sistema PWA unificado
const APP_VERSION = "2026-02-11-unified"
const CACHE_NAME = `pwa-shell-${APP_VERSION}`

const SHELL_URLS = [
  "/pwa",
  "/pwa/stock-console",
  "/manifest-pwa.json",
  "/icon-light-32x32.png",
  "/icon-dark-32x32.png",
  "/icon.svg",
  "/apple-icon.png",
]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith("pwa-shell-") && key !== CACHE_NAME) {
            return caches.delete(key)
          }
          return undefined
        })
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  if (event.request.mode === "navigate" && event.request.url.includes("/pwa/")) {
    event.respondWith(fetch(event.request).catch(() => caches.match("/pwa")))
    return
  }

  if (SHELL_URLS.some((url) => event.request.url.includes(url))) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
  }
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
