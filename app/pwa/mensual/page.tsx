"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { HorariosMensualesContent, HorariosMensualesLoading } from "@/components/horarios-mensuales-content"
import { useOwnerId } from "@/hooks/use-owner-id"
import { useData } from "@/contexts/data-context"

export default function PwaMensualPage() {
  const router = useRouter()
  const ownerId = useOwnerId()
  const { user, loading } = useData()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/pwa")
    }
  }, [loading, router, user])

  if (loading) {
    return <HorariosMensualesLoading />
  }

  if (!user) {
    return null
  }

  return (
    <Suspense fallback={<HorariosMensualesLoading />}>
      <HorariosMensualesContent ownerIdOverride={ownerId} />
    </Suspense>
  )
}
