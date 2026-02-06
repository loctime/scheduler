"use client"

import { useEffect, useState, Suspense, useRef } from "react"
import { useOwnerId } from "@/hooks/use-owner-id"
import { useRouter } from "next/navigation"
import { useData } from "@/contexts/data-context"
import { Loader2, AlertCircle } from "lucide-react"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { PWAUpdateNotification } from "@/components/pwa-update-notification"
import { 
  setHorarioOwnerId, 
  OWNER_ID_MISSING_ERROR, 
  getImageUrlWithCache, 
  getPwaHorarioUrls,
  loadPublishedHorario, 
  formatWeekHeader
} from "@/lib/pwa-horario"

function HorarioContent() {
  const ownerId = useOwnerId()
  const router = useRouter()
  const { loading: userLoading, user } = useData()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [weekHeader, setWeekHeader] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<number>(0)
  const blobUrlRef = useRef<string | null>(null)
  const pointerPositionsRef = useRef(new Map<number, { x: number; y: number }>())
  const dragStartRef = useRef({ x: 0, y: 0 })
  const panStartRef = useRef({ x: 0, y: 0 })
  const pinchStartRef = useRef({
    distance: 0,
    zoom: 1,
    pan: { x: 0, y: 0 },
    midpoint: { x: 0, y: 0 },
  })
  const sizeRef = useRef({
    imageWidth: 0,
    imageHeight: 0,
    containerWidth: 0,
    containerHeight: 0,
  })

  useEffect(() => {
    if (userLoading) return

    if (!user) {
      router.replace("/pwa")
      return
    }

    if (ownerId) {
      setHorarioOwnerId(ownerId)
      setError(null)
      loadFromCacheFirst(ownerId)
    } else {
      setError(OWNER_ID_MISSING_ERROR)
      setLoading(false)
    }
  }, [ownerId, router, user, userLoading])

  const loadFromCacheFirst = async (ownerId: string) => {
    try {
      const cached = await loadPublishedHorario(ownerId)

      if (cached?.imageBlob) {
        const blobUrl = URL.createObjectURL(cached.imageBlob)
        blobUrlRef.current = blobUrl
        setImageSrc(blobUrl)

        if (cached.metadata) {
          setWeekHeader(
            formatWeekHeader(cached.metadata.weekStart, cached.metadata.weekEnd)
          )
        }

        setLoading(false)
        return
      }

      // NO cache → ir a red
      await loadFromNetwork(ownerId)
    } catch {
      await loadFromNetwork(ownerId)
    }
  }

  const loadFromNetwork = async (ownerId: string) => {
    try {
      setLoading(true)

      const imageUrl = getImageUrlWithCache(ownerId)
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error()

      const imageBlob = await response.blob()

      const blobUrl = URL.createObjectURL(imageBlob)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = blobUrl

      setImageSrc(blobUrl)
      setLoading(false)

      try {
        const { cacheKey, imageUrl } = getPwaHorarioUrls(ownerId)
        const cache = await caches.open(cacheKey)
        await cache.put(
          imageUrl,
          new Response(imageBlob, {
            headers: { "Content-Type": imageBlob.type || "image/png" },
          })
        )
      } catch (cacheError) {
        console.warn("No se pudo guardar en cache:", cacheError)
      }
    } catch {
      setError('IMAGE_LOAD_ERROR')
      setLoading(false)
    }
  }

  const updateSizes = () => {
    const imageEl = imageRef.current
    const containerEl = containerRef.current
    if (!imageEl || !containerEl) return
    const imageRect = imageEl.getBoundingClientRect()
    const containerRect = containerEl.getBoundingClientRect()
    sizeRef.current = {
      imageWidth: imageRect.width / zoomLevel,
      imageHeight: imageRect.height / zoomLevel,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
    }
  }

  const clampPan = (nextPan: { x: number; y: number }, zoom = zoomLevel) => {
    const { imageWidth, imageHeight, containerWidth, containerHeight } = sizeRef.current
    if (!imageWidth || !imageHeight || !containerWidth || !containerHeight) {
      return nextPan
    }

    const scaledWidth = imageWidth * zoom
    const scaledHeight = imageHeight * zoom
    const extraWidth = Math.max(0, scaledWidth - containerWidth)
    const extraHeight = Math.max(0, scaledHeight - containerHeight)
    const maxPanX = extraWidth / 2
    const maxPanY = extraHeight / 2

    return {
      x: Math.min(maxPanX, Math.max(-maxPanX, nextPan.x)),
      y: Math.min(maxPanY, Math.max(-maxPanY, nextPan.y)),
    }
  }

  const getPointFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    }
  }

  const applyZoomAtPoint = (nextZoom: number, point: { x: number; y: number }) => {
    const ratio = nextZoom / zoomLevel
    const nextPan = {
      x: pan.x * ratio + (1 - ratio) * point.x,
      y: pan.y * ratio + (1 - ratio) * point.y,
    }
    setZoomLevel(nextZoom)
    setPan(clampPan(nextPan, nextZoom))
  }

  // Zoom por doble tap - mejorado para iOS
  const handleImageClick = (e: React.PointerEvent<HTMLDivElement>) => {
    const now = Date.now()
    const timeDiff = now - lastTapRef.current
    
    if (timeDiff < 300 && timeDiff > 0) {
      // Doble tap detectado
      e.preventDefault()
      
      const point = getPointFromEvent(e)
      if (zoomLevel === 1) {
        applyZoomAtPoint(2, point)
      } else {
        setZoomLevel(1)
        setPan({ x: 0, y: 0 })
      }
    }
    
    lastTapRef.current = now
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    pointerPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (zoomLevel > 1 || pointerPositionsRef.current.size >= 2) {
      container.setPointerCapture(e.pointerId)
    }

    if (pointerPositionsRef.current.size === 1 && zoomLevel > 1) {
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      panStartRef.current = { ...pan }
      setIsDragging(true)
    } else if (pointerPositionsRef.current.size === 2) {
      const points = Array.from(pointerPositionsRef.current.values())
      const dx = points[0].x - points[1].x
      const dy = points[0].y - points[1].y
      const distance = Math.hypot(dx, dy)
      const midpoint = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      }
      const rect = container.getBoundingClientRect()
      pinchStartRef.current = {
        distance,
        zoom: zoomLevel,
        pan: { ...pan },
        midpoint: {
          x: midpoint.x - rect.left - rect.width / 2,
          y: midpoint.y - rect.top - rect.height / 2,
        },
      }
      setIsDragging(false)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerPositionsRef.current.has(e.pointerId)) return
    pointerPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointerPositionsRef.current.size === 2) {
      const points = Array.from(pointerPositionsRef.current.values())
      const dx = points[0].x - points[1].x
      const dy = points[0].y - points[1].y
      const distance = Math.hypot(dx, dy)
      const scale = distance / pinchStartRef.current.distance
      const nextZoom = Math.min(5, Math.max(1, pinchStartRef.current.zoom * scale))
      const ratio = nextZoom / pinchStartRef.current.zoom
      const nextPan = {
        x: pinchStartRef.current.pan.x * ratio + (1 - ratio) * pinchStartRef.current.midpoint.x,
        y: pinchStartRef.current.pan.y * ratio + (1 - ratio) * pinchStartRef.current.midpoint.y,
      }
      setZoomLevel(nextZoom)
      setPan(clampPan(nextPan, nextZoom))
      return
    }

    if (pointerPositionsRef.current.size === 1 && zoomLevel > 1) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      const nextPan = {
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      }
      setPan(clampPan(nextPan))
    }
  }

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerPositionsRef.current.delete(e.pointerId)
    if (pointerPositionsRef.current.size < 2) {
      pinchStartRef.current.distance = 0
    }
    if (pointerPositionsRef.current.size === 0) {
      setIsDragging(false)
    }
  }

  // Cleanup de blob URLs
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    updateSizes()
  }, [zoomLevel, imageSrc])

  useEffect(() => {
    const handleResize = () => updateSizes()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30 shrink-0">
        <p className="text-sm text-muted-foreground">Horario publicado</p>
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
              <div 
                ref={containerRef}
                className="w-full h-full flex items-center justify-center p-2 cursor-pointer"
                style={{ 
                  touchAction: zoomLevel > 1 ? 'none' : 'pan-x pan-y'
                }}
                onPointerUp={handleImageClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerCancel={handlePointerEnd}
                onPointerUpCapture={handlePointerEnd}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Horario publicado"
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                    transformOrigin: "0 0",
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    pointerEvents: 'auto',
                    cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
                  }}
                  onLoad={updateSizes}
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
      <PWAUpdateNotification swPath="/sw-pwa.js" />
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
