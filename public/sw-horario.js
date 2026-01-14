// Service Worker para PWA de Horario del día
const CACHE_NAME = `horario-cache-v1`
const urlsToCache = [
  '/pwa/horario',
  '/manifest-horario.json',
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
        console.log('Service Worker Horario: Cache abierto')
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.error('Service Worker Horario: Error al cachear', error)
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
          // Solo borrar caches de esta PWA para no afectar otras PWAs
          if (cacheName.startsWith('horario-cache-') && cacheName !== CACHE_NAME) {
            console.log('Service Worker Horario: Eliminando cache antiguo', cacheName)
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
  const url = new URL(event.request.url)
  
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return
  }

  // Cachear la página principal
  if (url.pathname === '/pwa/horario') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone()
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(event.request).then((response) => {
            if (response) {
              return response
            }
            // Fallback básico si no hay cache
            return new Response('Offline - Horario no disponible', {
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            })
          })
        })
    )
    return
  }

  // Cachear imágenes de horarios que coincidan con el patrón /horarios/*/semana-*.png
  // También cachear URLs externas que contengan el patrón (ej: https://api.example.com/horarios/{userId}/semana-actual.png)
  // Patrón mejorado: solo acepta "semana-actual" o formato de fecha "semana-YYYY-MM"
  const isHorarioImage = url.pathname.match(/\/horarios\/[^/]+\/semana-(actual|\d{4}-\d{2})\.png/) ||
                         url.href.match(/\/horarios\/[^/]+\/semana-(actual|\d{4}-\d{2})\.png/)

  if (isHorarioImage) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Solo cachear si la respuesta es válida
          if (response.status === 200) {
            const responseToCache = response.clone()
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
            // Si no hay en cache, devolver una respuesta de error
            return new Response('Imagen no disponible offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            })
          })
        })
    )
    return
  }

  // Para otros recursos estáticos (manifest, iconos), usar cache primero
  if (url.pathname.startsWith('/manifest-horario.json') || 
      url.pathname.startsWith('/icon-') || 
      url.pathname.startsWith('/apple-icon.png')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return response
        })
      })
    )
    return
  }
})

// Manejo de mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
