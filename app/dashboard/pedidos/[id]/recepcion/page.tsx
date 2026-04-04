"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** La recepción de pedidos de grupo está en `/dashboard/recepciones` (logística nueva). */
export default function PedidoRecepcionRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/recepciones")
  }, [router])
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirigiendo a Recepciones…
    </div>
  )
}
