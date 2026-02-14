"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Redirección: la vista mensual PWA usa ahora /pwa/mensual?uid=XXXX
 * (misma fuente que el dashboard: schedules por ownerId).
 * Ya no se usa companySlug ni el endpoint público.
 */
export default function PwaMensualLegacyRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/pwa/mensual")
  }, [router])
  return null
}
