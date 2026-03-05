"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getPwaLastSlug, savePwaLastSlug } from "@/components/pwa/pwa-company-selector"
import { PwaCompanySelector } from "@/components/pwa/pwa-company-selector"
import { useCompanySlug } from "@/hooks/use-company-slug"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { listCompanySlugsFromOwnerId } from "@/lib/public-companies"

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
      const lastSlug = getPwaLastSlug()
      if (lastSlug) {
        router.replace(`/pwa/${lastSlug}/home`)
        return
      }

      if (slugLoading) return

      if (companySlug) {
        savePwaLastSlug(companySlug)
        router.replace(`/pwa/${companySlug}/home`)
        return
      }

      const ownerId = getOwnerIdForActor(user, userData) || user?.uid || null
      if (!ownerId) {
        if (!cancelled) setChecking(false)
        return
      }

      const slugs = await listCompanySlugsFromOwnerId(ownerId)
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
