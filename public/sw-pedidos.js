// Service Worker para PWA de Pedidos
const CACHE_NAME = 'pedidos-pwa-v1'
const urlsToCache = [
  '/',
  '/dashboard/pedidos',
  '/manifest-pedidos.json',
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
  '/icon.svg',
  '/apple-icon.png'
]

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker Pedidos: Cache abierto')
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.error('Service Worker Pedidos: Error al cachear', error)
      })
  )
  self.skipWaiting()
})

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker Pedidos: Eliminando cache antiguo', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// Estrategia: Network First, luego Cache
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clonar la respuesta
        const responseToCache = response.clone()

        // Cachear solo si es una respuesta válida
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }

        return response
      })
      .catch(() => {
        // Si falla la red, intentar desde cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response
          }
          // Si no hay en cache, devolver una respuesta offline básica
          if (event.request.destination === 'document') {
            return caches.match('/dashboard/pedidos')
          }
        })
      })
  )
})

// Manejo de mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
