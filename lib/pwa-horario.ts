export const PWA_HORARIO_CACHE = "horario-cache-v1"
export const PWA_HORARIO_IMAGE_URL = "/pwa/horario/published.png"
export const PWA_HORARIO_META_URL = "/pwa/horario/published.json"

export interface PublishedHorarioMetadata {
  weekStart: string
  weekEnd: string
  updatedAt: string
}

export async function savePublishedHorario(params: {
  imageBlob: Blob
  weekStart: string
  weekEnd: string
}): Promise<PublishedHorarioMetadata> {
  const cache = await caches.open(PWA_HORARIO_CACHE)
  const metadata: PublishedHorarioMetadata = {
    weekStart: params.weekStart,
    weekEnd: params.weekEnd,
    updatedAt: new Date().toISOString(),
  }

  await cache.put(
    PWA_HORARIO_IMAGE_URL,
    new Response(params.imageBlob, {
      headers: { "Content-Type": "image/png" },
    })
  )

  await cache.put(
    PWA_HORARIO_META_URL,
    new Response(JSON.stringify(metadata), {
      headers: { "Content-Type": "application/json" },
    })
  )

  return metadata
}

export async function loadPublishedHorario(): Promise<{
  imageBlob: Blob
  metadata: PublishedHorarioMetadata | null
} | null> {
  const cache = await caches.open(PWA_HORARIO_CACHE)
  const [imageResponse, metaResponse] = await Promise.all([
    cache.match(PWA_HORARIO_IMAGE_URL),
    cache.match(PWA_HORARIO_META_URL),
  ])

  if (!imageResponse) return null

  const imageBlob = await imageResponse.blob()
  const metadata = metaResponse ? ((await metaResponse.json()) as PublishedHorarioMetadata) : null

  return { imageBlob, metadata }
}
