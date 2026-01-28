"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"
import { setHorarioOwnerId, getHorarioOwnerId, OWNER_ID_MISSING_ERROR } from "@/lib/pwa-horario"

function HorarioContent() {
  const searchParams = useSearchParams()
  const urlOwnerId = searchParams.get("ownerId")
  const [loading, setLoading] = useState(true)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Prioridad: 1) URL parameter, 2) localStorage, 3) error
    let resolvedOwnerId: string | null = urlOwnerId
    
    if (!resolvedOwnerId) {
      resolvedOwnerId = getHorarioOwnerId()
    }
    
    if (resolvedOwnerId) {
      // Si tenemos ownerId (ya sea de URL o localStorage), guardarlo en localStorage
      setHorarioOwnerId(resolvedOwnerId)
      setOwnerId(resolvedOwnerId)
      setError(null)
    } else {
      setError(OWNER_ID_MISSING_ERROR)
    }
    
    setLoading(false)
  }, [urlOwnerId])

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30 shrink-0">
        <p className="text-sm text-muted-foreground">Horario publicado</p>
      </div>

      {/* Contenedor de imagen */}
      <div className="flex-1 overflow-auto bg-muted/20">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {!loading && error === OWNER_ID_MISSING_ERROR && (
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
              src={`${process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL}/api/horarios/semana-actual?ownerId=${encodeURIComponent(ownerId)}`}
              alt="Horario publicado"
              className="max-w-full max-h-full object-contain"
              onLoad={() => setLoading(false)}
              onError={() => setError('IMAGE_LOAD_ERROR')}
            />
          </div>
        )}
        
        {!loading && error === 'IMAGE_LOAD_ERROR' && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Error al cargar el horario.
              </p>
              <p className="text-xs text-muted-foreground">
                Intenta recargar la página o verifica tu conexión.
              </p>
            </div>
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
