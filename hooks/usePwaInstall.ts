"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface UsePwaInstallReturn {
  canInstall: boolean
  isInstalling: boolean
  isStandalone: boolean
  isIOS: boolean
  install: () => Promise<void>
  dismiss: () => void
}

/**
 * Hook global para manejar instalación de PWA.
 * 
 * Características:
 * - Escucha beforeinstallprompt globalmente
 * - Detecta iOS correctamente
 * - Detecta modo standalone (PWA ya instalada)
 * - Maneja estado de instalación
 * - Soporte para dismiss persistente
 */
export function usePwaInstall(): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  // Detectar iOS y standalone en montaje
  useEffect(() => {
    if (typeof window === "undefined") return

    // Detectar iOS (iPhone, iPad, iPod)
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setIsIOS(isIOSDevice)

    // Detectar modo standalone (PWA ya instalada)
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
                      (window.navigator as any).standalone === true
    setIsStandalone(standalone)
  }, [])

  // Escuchar beforeinstallprompt globalmente
  useEffect(() => {
    if (typeof window === "undefined") return
    if (isStandalone) return // No mostrar si ya está instalada

    const handler = (e: Event) => {
      e.preventDefault()
      const event = e as BeforeInstallPromptEvent
      setDeferredPrompt(event)
      setCanInstall(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    
    // Limpiar listener al desmontar
    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [isStandalone])

  // Verificar si fue dismiss recientemente
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const dismissed = localStorage.getItem("pwa-install-dismissed")
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10)
        const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60)
        if (hoursSinceDismissed < 24) {
          setCanInstall(false)
        }
      }
    } catch {
      // Ignorar errores de localStorage
    }
  }, [])

  const install = async (): Promise<void> => {
    if (!deferredPrompt || isInstalling) return

    setIsInstalling(true)
    try {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      
      // Limpiar después de la elección
      setDeferredPrompt(null)
      setCanInstall(false)
    } catch (error) {
      console.error("Error installing PWA:", error)
    } finally {
      setIsInstalling(false)
    }
  }

  const dismiss = (): void => {
    setCanInstall(false)
    try {
      localStorage.setItem("pwa-install-dismissed", Date.now().toString())
    } catch {
      // Ignorar errores de localStorage
    }
  }

  return {
    canInstall: canInstall && !isStandalone,
    isInstalling,
    isStandalone,
    isIOS,
    install,
    dismiss
  }
}
