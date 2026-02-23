// Service Worker único para el sistema PWA unificado
const APP_VERSION = "2026-02-14-slug-unified"
const CACHE_NAME = `pwa-shell-${APP_VERSION}`
const ASSETS_CACHE_NAME = `pwa-assets-${APP_VERSION}`

const SHELL_URLS = [
  "/pwa",
  "/manifest-pwa.json",
  "/icon-light-32x32.png",
  "/icon-dark-32x32.png",
  "/icon.svg",
  "/apple-icon.png",
]

// Assets que deben usar stale-while-revalidate
const ASSET_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.eot$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.webp$/,
  /\.svg$/,
  /\/_next\/static\//,
]

// Patrones para imágenes de horarios (data URLs o URLs públicas)
const HORARIO_IMAGE_PATTERNS = [
  /data:image\//, // Data URLs (base64)
  /publicImageUrl/,
  /pwa.*horario.*image/i,
]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
      caches.open(ASSETS_CACHE_NAME),
    ])
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (
            (key.startsWith("pwa-shell-") && key !== CACHE_NAME) ||
            (key.startsWith("pwa-assets-") && key !== ASSETS_CACHE_NAME)
          ) {
            return caches.delete(key)
          }
          return undefined
        })
      )
    )
  )
  self.clients.claim()
})

/**
 * Estrategia stale-while-revalidate para assets
 * Devuelve cache inmediatamente y actualiza en background
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS_CACHE_NAME)
  const cached = await cache.match(request)

  // Fetch en background para actualizar cache
  const fetchPromise = fetch(request)
    .then((response) => {
      // Solo cachear respuestas exitosas
      if (response.status === 200) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => {
      // Ignorar errores de fetch, usar cache si existe
    })

  // Devolver cache inmediatamente si existe, sino esperar fetch
  return cached || fetchPromise
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)

  // Navegación: network first con fallback a cache
  if (event.request.mode === "navigate" && url.pathname.includes("/pwa/")) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match("/pwa"))
        .catch(() => new Response("Offline", { status: 503 }))
    )
    return
  }

  // Shell URLs: cache first
  if (SHELL_URLS.some((shellUrl) => url.pathname.includes(shellUrl))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    )
    return
  }

  // Imágenes de horarios: cache-first (son data URLs o URLs públicas que no cambian frecuentemente)
  const isHorarioImage = HORARIO_IMAGE_PATTERNS.some((pattern) => 
    pattern.test(url.pathname) || pattern.test(event.request.url)
  )
  if (isHorarioImage) {
    event.respondWith(
      caches.open(ASSETS_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) {
          return cached
        }
        const response = await fetch(event.request)
        if (response.status === 200) {
          cache.put(event.request, response.clone())
        }
        return response
      })
    )
    return
  }

  // Assets estáticos: stale-while-revalidate
  const isAsset = ASSET_PATTERNS.some((pattern) => pattern.test(url.pathname))
  if (isAsset) {
    event.respondWith(staleWhileRevalidate(event.request))
    return
  }

  // Por defecto: network first
  event.respondWith(
    fetch(event.request).catch(() => {
      // Fallback a cache si está disponible
      return caches.match(event.request)
    })
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
