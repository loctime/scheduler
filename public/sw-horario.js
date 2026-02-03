// Service Worker exclusivo para PWA de Horario Público
// Scope limitado a /horario/

self.addEventListener('install', (event) => {
  console.log('SW Horario: Instalado')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('SW Horario: Activado')
  return self.clients.claim()
})

// Sin cache por ahora - solo pasar requests
self.addEventListener('fetch', (event) => {
  // No interceptar requests
  return
})
