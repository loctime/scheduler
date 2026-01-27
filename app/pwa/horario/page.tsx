"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"

function HorarioContent() {
  const searchParams = useSearchParams()
  const ownerId = searchParams.get("ownerId")
  const [imageUrl, setImageUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasPublished, setHasPublished] = useState(false)

  useEffect(() => {
    let active = true
    const fetchPublished = async () => {
      try {
        setLoading(true)
        setError(null)

        // Validar que se proporcionó ownerId
        if (!ownerId) {
          setError("Falta el ID del propietario del horario")
          setLoading(false)
          return
        }

        // Consumir desde el backend
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL
        if (!backendUrl) {
          setError('URL del backend no configurada')
          setLoading(false)
          return
        }
        
        const response = await fetch(`${backendUrl}/api/horarios/semana-actual?ownerId=${ownerId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            // No hay horario publicado
            setHasPublished(false)
            setImageUrl("")
            setLoading(false)
            return
          }
          throw new Error('Error al obtener el horario')
        }

        const data = await response.json()
        
        if (!active) return
        
        if (!data.imageUrl) {
          setHasPublished(false)
          setImageUrl("")
          setLoading(false)
          return
        }

        // Usar la URL pública del backend
        setHasPublished(true)
        setImageUrl(data.imageUrl)
        setLoading(false)
      } catch (err) {
        console.error("Error al cargar horario publicado:", err)
        if (!active) return
        setError("No se pudo cargar el horario publicado")
        setLoading(false)
      }
    }

    fetchPublished()

    return () => {
      active = false
    }
  }, [ownerId])

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30 shrink-0">
        <p className="text-sm text-muted-foreground">Horario publicado</p>
      </div>

      {/* Contenedor de imagen con scroll y zoom */}
      <div className="flex-1 overflow-auto bg-muted/20">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando horario...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && !hasPublished && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay un horario publicado para este usuario.
              </p>
              <p className="text-xs text-muted-foreground">
                El propietario debe publicar un horario desde la aplicación principal.
              </p>
            </div>
          </div>
        )}

        {imageUrl && (
          <div className="flex items-center justify-center min-h-full p-2">
            <img
              src={imageUrl}
              alt="Horario semanal"
              className="max-w-full h-auto object-contain"
              style={{
                minHeight: "100%",
                width: "auto",
                height: "auto",
              }}
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
