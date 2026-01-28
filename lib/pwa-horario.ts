export const PWA_HORARIO_CACHE = "horario-cache-v1"
export const PWA_HORARIO_OWNER_ID_KEY = "pwa_horario_owner_id"
export const OWNER_ID_MISSING_ERROR = "OWNER_ID_MISSING"

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
