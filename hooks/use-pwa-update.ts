"use client"

import { useEffect, useState } from "react"

interface PWAUpdateHook {
  registration: ServiceWorkerRegistration | null
  updateAvailable: boolean
  updateServiceWorker: () => void
}

/**
 * Hook para manejar actualizaciones del PWA
 * Detecta cuando hay una nueva versión del service worker disponible
 * y permite actualizarlo automáticamente
 */
export function usePWAUpdate(swPath: string = "/sw.js"): PWAUpdateHook {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    let isMounted = true

    // Registrar el service worker
    navigator.serviceWorker
      .register(swPath)
      .then((reg) => {
        if (!isMounted) return
        setRegistration(reg)

        // Detectar actualizaciones periódicamente (cada hora)
        const checkForUpdates = () => {
          reg.update()
        }
        
        // Verificar actualizaciones al cargar
        checkForUpdates()
        
        // Verificar actualizaciones cada hora
        const updateInterval = setInterval(checkForUpdates, 60 * 60 * 1000)

        // Escuchar cuando hay una nueva versión disponible
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Hay una nueva versión disponible
              setUpdateAvailable(true)
            }
          })
        })

        return () => clearInterval(updateInterval)
      })
      .catch((error) => {
        console.error("Error al registrar Service Worker:", error)
      })

    // Escuchar cuando el service worker toma control
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Recargar la página para usar la nueva versión
      window.location.reload()
    })

    return () => {
      isMounted = false
    }
  }, [swPath])

  const updateServiceWorker = () => {
    if (!registration || !registration.waiting) return

    // Enviar mensaje al service worker para que se active
    registration.waiting.postMessage({ type: "SKIP_WAITING" })
    setUpdateAvailable(false)
  }

  return {
    registration,
    updateAvailable,
    updateServiceWorker,
  }
}

