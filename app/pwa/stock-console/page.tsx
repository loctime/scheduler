"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getPwaLastSlug, savePwaLastSlug } from "@/components/pwa/pwa-company-selector"
import { useCompanySlug } from "@/hooks/use-company-slug"

/**
 * Entry de stock console sin slug.
 * Intenta resolver slug guardado o del usuario y redirige a /pwa/[slug]/stock-console.
 */
export default function PwaStockConsoleEntryPage() {
  const router = useRouter()
  const { companySlug, isLoading: slugLoading } = useCompanySlug()

  useEffect(() => {
    const lastSlug = getPwaLastSlug()
    if (lastSlug) {
      router.replace(`/pwa/${lastSlug}/stock-console`)
      return
    }

    if (!slugLoading) {
      if (companySlug) {
        savePwaLastSlug(companySlug)
        router.replace(`/pwa/${companySlug}/stock-console`)
      } else {
        router.replace("/pwa")
      }
    }
  }, [router, companySlug, slugLoading])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
