"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getPwaLastSlug, savePwaLastSlug } from "@/components/pwa/pwa-company-selector"
import { PwaCompanySelector } from "@/components/pwa/pwa-company-selector"
import { useCompanySlug } from "@/hooks/use-company-slug"

/**
 * Pagina de entrada PWA (/pwa).
 * - Si hay slug guardado -> redirect a /pwa/{slug}/home
 * - Si no, intenta resolver slug del usuario autenticado
 * - Si no hay slug -> pantalla de seleccion de empresa
 */
export default function PwaEntryPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [resolved, setResolved] = useState(false)
  const { companySlug, isLoading: slugLoading } = useCompanySlug()

  useEffect(() => {
    if (resolved) return

    const lastSlug = getPwaLastSlug()
    if (lastSlug) {
      router.replace(`/pwa/${lastSlug}/home`)
      setResolved(true)
      return
    }

    if (!slugLoading) {
      if (companySlug) {
        savePwaLastSlug(companySlug)
        router.replace(`/pwa/${companySlug}/home`)
        setResolved(true)
        return
      }

      setChecking(false)
      setResolved(true)
    }
  }, [router, slugLoading, companySlug, resolved])

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <PwaCompanySelector />
}
