"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"
import { loadPublishedHorario } from "@/lib/pwa-horario"

function HorarioContent() {
  const [imageUrl, setImageUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasPublished, setHasPublished] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    const fetchPublished = async () => {
      try {
        setLoading(true)
        setError(null)

        const published = await loadPublishedHorario()
        if (!active) return

        if (!published) {
          setHasPublished(false)
          setImageUrl("")
          setLoading(false)
          return
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
        }
        const objectUrl = URL.createObjectURL(published.imageBlob)
        objectUrlRef.current = objectUrl
        setHasPublished(true)
        setImageUrl(objectUrl)
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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

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
                Todavía no publicaste un horario. Volvé a la app y presioná “Actualizar PWA de horarios” en una semana.
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
