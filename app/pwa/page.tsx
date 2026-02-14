"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getPwaLastSlug } from "@/components/pwa/pwa-company-selector"
import { PwaCompanySelector } from "@/components/pwa/pwa-company-selector"

/**
 * Página de entrada PWA (/pwa).
 * - Si hay slug guardado en localStorage → redirect a /pwa/{slug}/home
 * - Si no → pantalla de selección de empresa
 */
export default function PwaEntryPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const lastSlug = getPwaLastSlug()
    if (lastSlug) {
      router.replace(`/pwa/${lastSlug}/home`)
    } else {
      setChecking(false)
    }
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <PwaCompanySelector />
}
