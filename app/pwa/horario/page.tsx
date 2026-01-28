"use client"

import { useEffect, useState, Suspense, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"
import { 
  setHorarioOwnerId, 
  getHorarioOwnerId, 
  OWNER_ID_MISSING_ERROR, 
  getImageUrlWithCache, 
  loadPublishedHorario, 
  formatWeekHeader,
  savePublishedHorario,
  getCurrentWeekDates
} from "@/lib/pwa-horario"

function HorarioContent() {
  const searchParams = useSearchParams()
  const urlOwnerId = searchParams.get("ownerId")
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [weekHeader, setWeekHeader] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 0.5, y: 0.5 })
  
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<number>(0)
  const blobUrlRef = useRef<string | null>(null)

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
      
      // Iniciar flujo CACHE-FIRST
      loadFromCacheFirst(resolvedOwnerId)
      
      // Agregar manifest dinámico con ownerId
      const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
      if (manifestLink) {
        manifestLink.href = `/api/manifest-horario?ownerId=${encodeURIComponent(resolvedOwnerId)}`
      } else {
        const link = document.createElement('link')
        link.rel = 'manifest'
        link.href = `/api/manifest-horario?ownerId=${encodeURIComponent(resolvedOwnerId)}`
        document.head.appendChild(link)
      }
    } else {
      setError(OWNER_ID_MISSING_ERROR)
      setLoading(false)
    }
  }, [urlOwnerId])

  const loadFromCacheFirst = async (resolvedOwnerId: string) => {
    try {
      // 1. Intentar cargar desde cache primero
      const cachedData = await loadPublishedHorario(resolvedOwnerId)
      
      if (cachedData?.imageBlob && cachedData?.metadata) {
        // ✅ Cache disponible: mostrar inmediatamente
        const blobUrl = URL.createObjectURL(cachedData.imageBlob)
        blobUrlRef.current = blobUrl
        setImageSrc(blobUrl)
        setWeekHeader(formatWeekHeader(cachedData.metadata.weekStart, cachedData.metadata.weekEnd))
        setLoading(false)
        
        // En background, verificar si hay actualización
        checkForUpdates(resolvedOwnerId, cachedData.metadata)
      } else {
        // ❌ Sin cache: cargar desde red
        loadFromNetwork(resolvedOwnerId)
      }
    } catch (err) {
      console.error('Error cargando desde cache:', err)
      loadFromNetwork(resolvedOwnerId)
    }
  }

  const checkForUpdates = async (resolvedOwnerId: string, currentMetadata: any) => {
    try {
      const imageUrl = getImageUrlWithCache(resolvedOwnerId)
      const response = await fetch(imageUrl, { 
        method: 'HEAD',
        cache: 'no-cache' 
      })
      
      if (response.ok) {
        const lastModified = response.headers.get('last-modified')
        const cachedDate = new Date(currentMetadata.updatedAt)
        const serverDate = lastModified ? new Date(lastModified) : new Date()
        
        // Si el servidor tiene versión más reciente, actualizar
        if (!lastModified || serverDate > cachedDate) {
          console.log('Actualizando imagen desde servidor...')
          loadFromNetwork(resolvedOwnerId, true)
        }
      }
    } catch (err) {
      console.error('Error verificando actualizaciones:', err)
    }
  }

  const loadFromNetwork = async (resolvedOwnerId: string, isUpdate = false) => {
    try {
      if (!isUpdate) {
        setLoading(false)
        setUpdating(true)
      }
      
      const imageUrl = getImageUrlWithCache(resolvedOwnerId)
      const response = await fetch(imageUrl)
      
      if (!response.ok) {
        throw new Error('Error al cargar imagen')
      }
      
      const imageBlob = await response.blob()
      
      // Obtener fechas de semana actuales como fallback
      const weekDates = getCurrentWeekDates()
      
      // ✅ Guardar en cache con metadata
      await savePublishedHorario({
        imageBlob,
        weekStart: weekDates.weekStart,
        weekEnd: weekDates.weekEnd,
        ownerId: resolvedOwnerId
      })
      
      // Actualizar UI
      const blobUrl = URL.createObjectURL(imageBlob)
      
      // Limpiar blob anterior
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
      blobUrlRef.current = blobUrl
      
      setImageSrc(blobUrl)
      setWeekHeader(formatWeekHeader(weekDates.weekStart, weekDates.weekEnd))
      setUpdating(false)
      
    } catch (err) {
      console.error('Error cargando desde red:', err)
      if (!isUpdate) {
        setError('IMAGE_LOAD_ERROR')
        setLoading(false)
      }
      setUpdating(false)
    }
  }

  // Zoom por doble tap
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now()
    const timeDiff = now - lastTapRef.current
    
    if (timeDiff < 300 && timeDiff > 0) {
      // Doble tap detectado
      e.preventDefault()
      
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height
        
        if (zoomLevel === 1) {
          setZoomLevel(2)
          setZoomOrigin({ x, y })
        } else {
          setZoomLevel(1)
          setZoomOrigin({ x: 0.5, y: 0.5 })
        }
      }
    }
    
    lastTapRef.current = now
  }

  // Cleanup de blob URLs
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30 shrink-0">
        <p className="text-sm text-muted-foreground">Horario publicado</p>
        {updating && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Actualizando...</span>
          </div>
        )}
      </div>

      {/* Contenedor de imagen */}
      <div className="flex-1 overflow-auto bg-muted/20">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando horario...</p>
            </div>
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

        {!loading && ownerId && imageSrc && (
          <div className="flex flex-col h-full">
            {/* Encabezado de semana */}
            {weekHeader && (
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 shadow-lg z-10">
                <div className="text-center">
                  <h2 className="text-lg font-semibold tracking-wide">
                    {weekHeader}
                  </h2>
                </div>
              </div>
            )}
            
            {/* Contenedor de imagen con zoom */}
            <div className="flex-1 relative overflow-hidden">
              {updating && (
                <div className="absolute top-2 right-2 z-20">
                  <div className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
                    Actualizando...
                  </div>
                </div>
              )}
              
              <div 
                ref={containerRef}
                className="w-full h-full flex items-center justify-center p-2 cursor-pointer"
                style={{ touchAction: 'pan-x pan-y' }}
                onClick={handleImageClick}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Horario publicado"
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{ 
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: `${zoomOrigin.x * 100}% ${zoomOrigin.y * 100}%`,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    pointerEvents: 'auto',
                    cursor: zoomLevel > 1 ? 'zoom-out' : 'zoom-in'
                  }}
                  onError={() => {
                    setError('IMAGE_LOAD_ERROR')
                    setLoading(false)
                  }}
                />
              </div>
            </div>
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
