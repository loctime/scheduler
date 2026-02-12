"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { X, Download } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Botón de instalación PWA. Solo se muestra bajo /pwa.
 * Usa beforeinstallprompt, event.prompt(), y se oculta si ya está instalada (standalone).
 */
export function PWAInstallPrompt() {
  const pathname = usePathname()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(display-mode: standalone)").matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    try {
      localStorage.setItem("pwa-install-dismissed", Date.now().toString())
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("pwa-install-dismissed")
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10)
        const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60)
        if (hoursSinceDismissed < 24) setShowPrompt(false)
      }
    } catch {
      // ignore
    }
  }, [])

  // Solo mostrar bajo /pwa
  if (typeof pathname !== "string" || !pathname.startsWith("/pwa")) return null
  if (!showPrompt || !deferredPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Instalar como app</p>
          <p className="text-xs text-muted-foreground">
            Instalá la app para acceder rápido desde tu pantalla de inicio
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={handleInstall}
            className="gap-2 flex-1 sm:flex-initial"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Instalar</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

