"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useCompanySlug } from "@/hooks/use-company-slug"

export default function PwaEntryPage() {
  const router = useRouter()
  const { companySlug, isLoading } = useCompanySlug()
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (hasRedirected.current) return
    if (isLoading) return
    if (companySlug) {
      hasRedirected.current = true
      router.replace(`/pwa/horario/${companySlug}`)
      return
    }
    hasRedirected.current = true
    router.replace("/pwa/home")
  }, [companySlug, isLoading, router])

  // Fallback: si el hook no resuelve (ej. auth no listo), redirigir a home tras 1.5s
  useEffect(() => {
    const t = setTimeout(() => {
      if (hasRedirected.current) return
      hasRedirected.current = true
      router.replace("/pwa/home")
    }, 1500)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirigiendo...</p>
    </div>
  )
}
