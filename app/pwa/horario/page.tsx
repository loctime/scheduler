"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"

function HorarioContent() {
  const searchParams = useSearchParams()
  const ownerId = searchParams.get("ownerId")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Solo validar que se proporcionó ownerId
    if (!ownerId) {
      setLoading(false)
      return
    }
    
    setLoading(false)
  }, [ownerId])

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30 shrink-0">
        <p className="text-sm text-muted-foreground">Horario publicado</p>
      </div>

      {/* Contenedor de imagen */}
      <div className="flex-1 overflow-auto bg-muted/20">
        {!loading && !ownerId && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Falta el ID del propietario del horario.
              </p>
              <p className="text-xs text-muted-foreground">
                Usa el enlace completo proporcionado por el propietario.
              </p>
            </div>
          </div>
        )}

        {!loading && ownerId && (
          <div className="flex items-center justify-center min-h-full p-2">
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL}/api/horarios/semana-actual?ownerId=${encodeURIComponent(ownerId || '')}`}
              alt="Horario publicado"
              className="max-w-full max-h-full object-contain"
              onLoad={() => setLoading(false)}
            />
          </div>
        )}
      </div>

      {/* Componentes PWA */}
      <PWAInstallPrompt />
      <PWAUpdateNotification swPath="/pwa/horario/sw.js" />
    </div>
  )
}

export default function HorarioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <HorarioContent />
    </Suspense>
  )
}
