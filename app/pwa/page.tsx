"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getPwaLastSlug, savePwaLastSlug, clearPwaLastSlug } from "@/components/pwa/pwa-company-selector"
import { PwaCompanySelector } from "@/components/pwa/pwa-company-selector"
import { useCompanySlug } from "@/hooks/use-company-slug"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { listCompanySlugsFromOwnerId, resolvePublicCompany } from "@/lib/public-companies"

/**
 * Pagina de entrada PWA (/pwa).
 * - Si hay slug guardado -> redirect a /pwa/{slug}/home
 * - Si hay solo un slug para la cuenta -> redirect automatico
 * - Si hay varios slugs -> selector con lista
 * - Si no hay datos -> ingreso manual de slug
 */
export default function PwaEntryPage() {
  const router = useRouter()
  const { user, userData } = useData()
  const [checking, setChecking] = useState(true)
  const [suggestedSlugs, setSuggestedSlugs] = useState<string[]>([])
  const { companySlug, isLoading: slugLoading } = useCompanySlug()

  useEffect(() => {
    let cancelled = false

    const resolveEntry = async () => {
      // Si el usuario tiene rol colaborador u operador, 
      // mandarlo directo al dashboard
      if (userData?.role === "colaborador" || userData?.role === "operador") {
        router.replace("/dashboard/recepciones")
        return
      }

      const lastSlug = getPwaLastSlug()
      if (lastSlug) {
        const company = await resolvePublicCompany(lastSlug)
        if (company) {
          router.replace(`/pwa/${lastSlug}/home`)
          return
        }
        clearPwaLastSlug()
      }

      if (slugLoading) return

      if (companySlug) {
        savePwaLastSlug(companySlug)
        router.replace(`/pwa/${companySlug}/home`)
        return
      }

      // Intentar primero con el ownerId del actor (admin: su propio uid)
      const ownerId = getOwnerIdForActor(user, userData) || user?.uid || null

      // Si el usuario es colaborador/operador invitado, su ownerId
      // apunta al admin que lo creó — intentar con ese también
      const ownerIdAlternativo = userData?.ownerId ?? null

      let slugs: string[] = []

      if (ownerId) {
        slugs = await listCompanySlugsFromOwnerId(ownerId)
      }

      // Si no encontró nada, intentar con el ownerId del admin padre
      if (slugs.length === 0 && ownerIdAlternativo && ownerIdAlternativo !== ownerId) {
        slugs = await listCompanySlugsFromOwnerId(ownerIdAlternativo)
      }

      if (cancelled) return

      if (slugs.length === 1) {
        savePwaLastSlug(slugs[0])
        router.replace(`/pwa/${slugs[0]}/home`)
        return
      }

      setSuggestedSlugs(slugs)
      setChecking(false)
    }

    resolveEntry()

    return () => {
      cancelled = true
    }
  }, [router, slugLoading, companySlug, user, userData])

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <PwaCompanySelector suggestedSlugs={suggestedSlugs} />
}
