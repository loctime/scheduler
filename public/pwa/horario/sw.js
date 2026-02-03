// Service Worker para PWA de Horario Público
// Versión mínima sin cache por ahora

self.addEventListener('install', (event) => {
  console.log('Service Worker Horario: Instalado')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker Horario: Activado')
  return self.clients.claim()
})

// Sin estrategia de cache por ahora - solo pasar requests
self.addEventListener('fetch', (event) => {
  // No interceptar requests por ahora
  return
})
