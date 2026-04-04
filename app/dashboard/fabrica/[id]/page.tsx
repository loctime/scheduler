"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function FabricaDetalleRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/logistica-fabrica")
  }, [router])
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirigiendo a Fábrica…
    </div>
  )
}
