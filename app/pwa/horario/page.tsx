"use client"

// Frontend rule:
// Nunca llamar /api/* de forma relativa.
// Siempre usar NEXT_PUBLIC_BACKEND_URL para ControlFile.

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider, useData } from "@/contexts/data-context"
import { Loader2, RefreshCw, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"

function HorarioContent({ ownerIdFromQuery }: { ownerIdFromQuery: string | null }) {
  const { userData } = useData()
  const [imageUrl, setImageUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Obtener userId efectivo:
  // 1. Si viene ownerId desde query (modo público), usarlo
  // 2. Si es invitado autenticado, usar ownerId
  // 3. Si no, usar uid del usuario autenticado
  const userId = ownerIdFromQuery || 
    (userData?.role === "invited" && userData?.ownerId 
      ? userData.ownerId 
      : userData?.uid)

  useEffect(() => {
    if (!userId) {
      setError("Usuario no identificado")
      setLoading(false)
      return
    }

    // Frontend rule:
    // Nunca llamar /api/* de forma relativa.
    // Siempre usar NEXT_PUBLIC_BACKEND_URL para ControlFile.
    // Primero hacer fetch al backend para obtener la URL pública
    const fetchImageUrl = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/horarios/semana-actual?ownerId=${encodeURIComponent(userId)}`
        )
        
        if (!response.ok) {
          throw new Error(`Error al obtener horario: ${response.status}`)
        }
        
        // El endpoint devuelve un JSON con la URL pública
        const data = await response.json()
        const publicUrl = data.url || data.imageUrl || data.publicUrl
        
        if (!publicUrl) {
          throw new Error("No se recibió URL pública del backend")
        }
        
        setImageUrl(publicUrl)
        setLoading(false)
      } catch (err) {
        console.error("Error al obtener URL del horario:", err)
        setError(err instanceof Error ? err.message : "No se pudo cargar el horario")
        setLoading(false)
        setImageUrl("")
      }
    }
    
    fetchImageUrl()
  }, [userId])

  const handleRefresh = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    setImageLoaded(false)
    
    try {
      // Frontend rule:
      // Nunca llamar /api/* de forma relativa.
      // Siempre usar NEXT_PUBLIC_BACKEND_URL para ControlFile.
      // Hacer fetch al backend para obtener la URL pública actualizada
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/horarios/semana-actual?ownerId=${encodeURIComponent(userId)}`
      )
      
      if (!response.ok) {
        throw new Error(`Error al obtener horario: ${response.status}`)
      }
      
      // El endpoint devuelve un JSON con la URL pública
      const data = await response.json()
      const publicUrl = data.url || data.imageUrl || data.publicUrl
      
      if (!publicUrl) {
        throw new Error("No se recibió URL pública del backend")
      }
      
      // Usar timestamp para forzar recarga de la imagen
      const urlWithCacheBuster = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
      setImageUrl(urlWithCacheBuster)
      
      // El estado de carga se manejará automáticamente cuando la imagen cargue
    } catch (err) {
      console.error("Error al refrescar horario:", err)
      setError(err instanceof Error ? err.message : "No se pudo actualizar el horario")
      setLoading(false)
    }
  }

  const handleImageLoad = () => {
    setImageLoaded(true)
    setLoading(false)
    setError(null)
  }

  const handleImageError = () => {
    setError("No se pudo cargar la imagen del horario")
    setLoading(false)
    setImageLoaded(false)
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      {/* Header mínimo - solo botón de refresh */}
      <div className="flex items-center justify-end p-2 border-b border-border bg-muted/30 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleRefresh}
          title="Actualizar horario"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Contenedor de imagen con scroll y zoom */}
      <div className="flex-1 overflow-auto bg-muted/20">
        {loading && !imageLoaded && (
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-2"
              >
                Reintentar
              </Button>
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
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
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

function HorarioPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ownerIdFromQuery = searchParams.get("ownerId")
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Si viene ownerId desde query, no requerir autenticación (modo público)
    if (ownerIdFromQuery) {
      setLoading(false)
      return
    }

    // Si no viene ownerId, requerir autenticación (modo privado)
    if (!isFirebaseConfigured() || !auth) {
      router.push("/")
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/")
      } else {
        setUser(currentUser)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router, ownerIdFromQuery])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Modo público: no requiere autenticación
  if (ownerIdFromQuery) {
    return (
      // Crear un usuario dummy para DataProvider (no se usa realmente)
      <DataProvider user={{ uid: ownerIdFromQuery } as any}>
        <HorarioContent ownerIdFromQuery={ownerIdFromQuery} />
      </DataProvider>
    )
  }

  // Modo privado: requiere autenticación
  if (!user) {
    return null
  }

  return (
    <DataProvider user={user}>
      <HorarioContent ownerIdFromQuery={null} />
    </DataProvider>
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
      <HorarioPageContent />
    </Suspense>
  )
}
