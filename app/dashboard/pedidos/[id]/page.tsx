"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** El detalle por ID pasó a la vista principal `/dashboard/pedidos`. */
export default function PedidoDetalleRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/pedidos")
  }, [router])
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirigiendo a Pedidos…
    </div>
  )
}
