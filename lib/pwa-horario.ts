export const PWA_HORARIO_CACHE = "horario-cache-v1"
export const PWA_HORARIO_OWNER_ID_KEY = "pwa_horario_owner_id"
export const OWNER_ID_MISSING_ERROR = "OWNER_ID_MISSING"

// Soporte para formatos de imagen
export function getSupportedImageFormat(): 'webp' | 'png' {
  if (typeof window !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'webp' : 'png'
  }
  return 'png' // Fallback para SSR
}

// Optimización de carga con cache del Service Worker
export function getImageUrlWithCache(ownerId: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  const format = getSupportedImageFormat()
  
  // URL estable sin timestamp para permitir cache real
  return `${base}/api/horarios/semana-actual?ownerId=${encodeURIComponent(ownerId)}&format=${format}`
}

// Helpers para persistir el ownerId en localStorage
export function setHorarioOwnerId(ownerId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PWA_HORARIO_OWNER_ID_KEY, ownerId)
  }
}

export function getHorarioOwnerId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PWA_HORARIO_OWNER_ID_KEY)
  }
  return null
}

export function getPwaHorarioUrls(ownerId?: string) {
  const resolvedOwnerId = ownerId || getHorarioOwnerId()
  
  if (!resolvedOwnerId) {
    throw new Error(OWNER_ID_MISSING_ERROR)
  }
  
  return {
    imageUrl: `/pwa/horario/${resolvedOwnerId}/published.png`,
    metaUrl: `/pwa/horario/${resolvedOwnerId}/published.json`,
    cacheKey: `horario-cache-${resolvedOwnerId}`
  }
}

export interface PublishedHorarioMetadata {
  weekStart: string
  weekEnd: string
  updatedAt: string
}

// Función para formatear encabezado de semana
export function formatWeekHeader(weekStart: string, weekEnd: string): string {
  const startDate = new Date(weekStart)
  const endDate = new Date(weekEnd)
  
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  
  const startMonth = monthNames[startDate.getMonth()]
  const endMonth = monthNames[endDate.getMonth()]
  const startDay = startDate.getDate()
  const endDay = endDate.getDate()
  
  // Si es el mismo mes
  if (startMonth === endMonth) {
    return `${startMonth} – semana del ${startDay} al ${endDay}`
  }
  
  // Si cruzan meses
  return `${startMonth}/${endMonth} – semana del ${startDay} al ${endDay}`
}

// Función para guardar imagen con metadata de semana
export async function saveHorarioWithMetadata(params: {
  imageBlob: Blob
  weekStart: string
  weekEnd: string
  ownerId?: string
}): Promise<PublishedHorarioMetadata> {
  return savePublishedHorario(params)
}

// Función para obtener fecha de semana actual (fallback)
export function getCurrentWeekDates(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = domingo, 1 = lunes, etc.
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)) // Lunes
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6) // Domingo
  
  return {
    weekStart: startOfWeek.toISOString().split('T')[0],
    weekEnd: endOfWeek.toISOString().split('T')[0]
  }
}

export async function savePublishedHorario(params: {
  imageBlob: Blob
  weekStart: string
  weekEnd: string
  ownerId?: string
}): Promise<PublishedHorarioMetadata> {
  const urls = getPwaHorarioUrls(params.ownerId)
  const cache = await caches.open(urls.cacheKey)
  const metadata: PublishedHorarioMetadata = {
    weekStart: params.weekStart,
    weekEnd: params.weekEnd,
    updatedAt: new Date().toISOString(),
  }

  await cache.put(
    urls.imageUrl,
    new Response(params.imageBlob, {
      headers: { "Content-Type": "image/png" },
    })
  )

  await cache.put(
    urls.metaUrl,
    new Response(JSON.stringify(metadata), {
      headers: { "Content-Type": "application/json" },
    })
  )

  return metadata
}

export async function loadPublishedHorario(ownerId?: string): Promise<{
  imageBlob: Blob
  metadata: PublishedHorarioMetadata | null
} | null> {
  const urls = getPwaHorarioUrls(ownerId)
  const cache = await caches.open(urls.cacheKey)
  const [imageResponse, metaResponse] = await Promise.all([
    cache.match(urls.imageUrl),
    cache.match(urls.metaUrl),
  ])

  if (!imageResponse) return null

  const imageBlob = await imageResponse.blob()
  const metadata = metaResponse ? ((await metaResponse.json()) as PublishedHorarioMetadata) : null

  return { imageBlob, metadata }
}
