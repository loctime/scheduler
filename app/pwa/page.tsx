"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCompanySlug } from "@/hooks/use-company-slug"

export default function PwaEntryPage() {
  const router = useRouter()
  const { companySlug, isLoading } = useCompanySlug()

  useEffect(() => {
    if (isLoading) return
    if (companySlug) {
      router.replace(`/pwa/horario/${companySlug}`)
      return
    }
    router.replace("/pwa/home")
  }, [companySlug, isLoading, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirigiendo...</p>
    </div>
  )
}
